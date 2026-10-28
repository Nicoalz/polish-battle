import { create } from 'zustand'
import { Client, type Room } from 'colyseus.js'
import type { Action, Emote, GameEvent, GameState, OptionKey } from '@pb/engine'
import { EMOTE_TTL_MS, fromWire, type WireGame } from '@pb/engine'
import { getPlayerId, saveAvatar, saveName } from './identity'
import { dict, type RejectionCode } from '../i18n'

/**
 * Adresse du serveur de jeu.
 *
 * En production le serveur sert aussi le client : on vise donc l'origine courante, sans
 * rien à configurer. En développement Vite tourne sur 5173 et le serveur sur 2567.
 * `VITE_SERVER_URL` permet de forcer une autre adresse si besoin.
 */
function defaultServerUrl(): string {
  const { protocol, hostname, port, host } = window.location
  if (port === '5173') return `ws://${hostname}:2567`
  return `${protocol === 'https:' ? 'wss' : 'ws'}://${host}`
}

const SERVER_URL = import.meta.env.VITE_SERVER_URL ?? defaultServerUrl()

/** Même hôte que le jeu, mais en HTTP : c'est par là qu'on demande la liste des salons. */
const HTTP_URL = SERVER_URL.replace(/^ws/, 'http')

/** Fenêtre pendant laquelle on retente de reprendre la partie après une coupure. */
const RECONNECT_ATTEMPTS = 20
const RECONNECT_DELAY_MS = 3000

export type ConnectionStatus = 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'error'

/** Ce qu'un salon public annonce de lui-même avant qu'on y entre. */
export type RoomSummary = {
  code: string
  players: number
  phase: string
}

/**
 * Un lot d'événements, avec la version d'état qu'il produit.
 *
 * La version est indispensable : la diffusion des événements et le correctif d'état
 * voyagent par deux canaux distincts, et les événements arrivent presque toujours les
 * premiers. Valider l'affichage sans attendre reviendrait à afficher l'état d'avant.
 */
export type Batch = { version: number; events: GameEvent[] }

/**
 * L'historique conserve les événements bruts, par action, et non des phrases : la mise
 * en mots a lieu à l'affichage, donc changer de langue retraduit aussi le passé. Un lot
 * correspondant à une action, il donnera exactement une ligne.
 */
export type LogEntry =
  | { id: number; kind: 'action'; events: GameEvent[] }
  | { id: number; kind: 'rejection'; code: RejectionCode }

type Store = {
  status: ConnectionStatus
  error?: string
  code: string
  playerId: string
  /** État autoritaire, tel que le serveur vient de le diffuser. */
  game?: GameState
  /**
   * État réellement rendu. Il reste en arrière de l'état autoritaire le temps que les
   * animations racontent ce qui s'est passé : sans cela, une carte de vie afficherait
   * déjà sa nouvelle valeur pendant que la carte d'attaque est encore en vol.
   */
  display?: GameState
  /** Lots d'événements en attente d'être joués, un lot par action. */
  queue: Batch[]
  /** Vrai tant qu'une mise en scène est en cours. */
  animating: boolean
  /** Version de l'état autoritaire : elle avance d'un cran par action appliquée. */
  version: number
  /** Dernière version déjà racontée à l'écran. */
  playedVersion: number
  log: LogEntry[]
  /** Salons publics ouverts, rafraîchis depuis la page d'accueil. */
  openRooms: RoomSummary[]
  /**
   * Réactions visibles à l'instant, par joueur.
   *
   * Hors de l'état de jeu, et à dessein : une réaction n'est pas un coup, elle ne doit
   * ni attendre son tour dans la file d'animations ni survivre à son instant.
   */
  reactions: Record<string, { emote: Emote; at: number }>

  connect: (
    code: string,
    name: string,
    avatar: string,
    visibility?: 'public' | 'private',
  ) => Promise<void>
  /** Interroge le serveur sur les salons publics joignables. */
  refreshRooms: () => Promise<void>
  leave: () => Promise<void>
  send: (action: Action) => void
  command: (type: 'start' | 'restart' | 'skip') => void
  /** Règle une option de partie. Le serveur refusera si l'on n'est pas hôte. */
  setOption: (key: OptionKey, value: boolean) => void
  /** Envoie une réaction à la table. Le serveur l'espace et la valide. */
  react: (emote: Emote) => void
  kick: (playerId: string) => void

  /** Retire le prochain lot à jouer, ou `undefined` s'il n'y a plus rien en attente. */
  consume: () => Batch | undefined
  /** Fait rattraper à l'affichage l'état produit par le lot `version`. */
  commit: (version: number) => void
  /** Inscrit une action à l'historique, au moment où elle devient visible. */
  remember: (events: GameEvent[]) => void
  setAnimating: (animating: boolean) => void
}

let room: Room | undefined
let latestRaw: WireGame | undefined
let leavingOnPurpose = false
let logSeq = 0

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export const useGame = create<Store>((set, get) => {
  /** Recalcule l'état autoritaire, et l'affichage avec lui s'il n'y a plus rien à raconter. */
  const refresh = (): void => {
    if (!latestRaw) return
    const next = fromWire(latestRaw)
    const { playedVersion, animating, queue } = get()
    const settled = latestRaw.version === playedVersion && !animating && queue.length === 0
    set(settled ? { game: next, display: next } : { game: next })
  }

  const attach = (joined: Room, code: string): void => {
    room = joined

    joined.onStateChange((state) => {
      latestRaw = (state as unknown as { toJSON(): WireGame }).toJSON()
      set({ version: latestRaw.version })
      refresh()
    })

    joined.onMessage('events', (payload: Batch) => {
      // L'historique n'est pas alimenté ici : il le sera au moment où la mise en scène
      // dévoile le résultat. L'inscrire à la réception reviendrait à annoncer les dégâts
      // pendant que la carte est encore en l'air.
      set((current) => ({
        queue: [...current.queue, { version: payload.version, events: payload.events }],
      }))
    })

    joined.onMessage('emote', (payload: { playerId: string; emote: Emote }) => {
      const at = Date.now()
      set((current) => ({
        reactions: { ...current.reactions, [payload.playerId]: { emote: payload.emote, at } },
      }))

      // La bulle s'efface d'elle-même. On vérifie l'horodatage avant de retirer : une
      // réaction plus récente a pu prendre la place entre-temps, et l'effacer serait
      // obéir à la minuterie de la précédente.
      window.setTimeout(() => {
        set((current) => {
          if (current.reactions[payload.playerId]?.at !== at) return current
          const next = { ...current.reactions }
          delete next[payload.playerId]
          return { reactions: next }
        })
      }, EMOTE_TTL_MS)
    })

    joined.onMessage('rejected', (payload: { code: RejectionCode }) => {
      set((current) => ({
        log: [
          ...current.log,
          { id: logSeq++, kind: 'rejection', code: payload.code } as LogEntry,
        ].slice(-60),
      }))
    })

    joined.onError((_code, message) => set({ status: 'error', error: message }))
    joined.onLeave(() => void handleLeave(joined, code))

    set({ status: 'connected', code })
  }

  /**
   * Une coupure réseau ne doit pas renvoyer au formulaire de connexion.
   *
   * Le serveur garde le siège ouvert une minute : on retente pendant toute cette
   * fenêtre, et le joueur retrouve sa place et ses cartes sans rien avoir à refaire.
   */
  const handleLeave = async (previous: Room, code: string): Promise<void> => {
    if (leavingOnPurpose) {
      leavingOnPurpose = false
      return
    }

    const token = previous.reconnectionToken
    if (!token) {
      set({ status: 'idle', game: undefined, display: undefined })
      return
    }

    set({ status: 'reconnecting' })
    const client = new Client(SERVER_URL)

    for (let attempt = 0; attempt < RECONNECT_ATTEMPTS; attempt++) {
      await wait(RECONNECT_DELAY_MS)
      if (get().status !== 'reconnecting') return
      try {
        attach(await client.reconnect(token), code)
        return
      } catch {
        // Le serveur n'est pas encore revenu : on laisse la fenêtre courir.
      }
    }

    set({ status: 'idle', game: undefined, display: undefined })
  }

  return {
    status: 'idle',
    code: '',
    playerId: getPlayerId(),
    queue: [],
    animating: false,
    version: 0,
    playedVersion: 0,
    log: [],
    openRooms: [],
    reactions: {},

    async refreshRooms() {
      try {
        const response = await fetch(`${HTTP_URL}/rooms`)
        const rooms = (await response.json()) as RoomSummary[]
        set({ openRooms: rooms.sort((a, b) => b.players - a.players) })
      } catch {
        // Serveur injoignable : la liste reste telle quelle plutôt que de clignoter.
      }
    },

    async connect(code, name, avatar, visibility = 'private') {
      if (get().status === 'connecting') return
      set({ status: 'connecting', error: undefined })
      saveName(name)
      saveAvatar(avatar)

      const target = code.trim().toUpperCase()
      try {
        const client = new Client(SERVER_URL)
        attach(
          await client.joinOrCreate('game', {
            code: target,
            playerId: get().playerId,
            name,
            avatar,
            visibility,
          }),
          target,
        )
      } catch (error) {
        set({
          status: 'error',
          error: error instanceof Error ? error.message : dict().lobby.connectionFailed,
        })
      }
    },

    async leave() {
      leavingOnPurpose = true
      await room?.leave(true)
      room = undefined
      latestRaw = undefined
      set({
        status: 'idle',
        game: undefined,
        display: undefined,
        queue: [],
        version: 0,
        playedVersion: 0,
        log: [],
        reactions: {},
      })
    },

    send(action) {
      room?.send('action', action)
    },

    command(type) {
      room?.send(type)
    },

    setOption(key, value) {
      room?.send('options', { [key]: value })
    },

    react(emote) {
      room?.send('emote', { emote })
    },

    kick(playerId) {
      room?.send('kick', { playerId })
    },

    consume() {
      const [next, ...rest] = get().queue
      if (!next) return undefined
      set({ queue: rest })
      return next
    },

    /**
     * Fait avancer l'affichage jusqu'à l'état produit par ce lot précisément.
     *
     * Valider la version la plus récente ferait apparaître d'un coup le résultat de
     * plusieurs actions, et marquerait comme racontés des lots encore en file — ce qui
     * désactiverait ensuite tout le décalage, silencieusement.
     */
    commit(version) {
      if (!latestRaw || latestRaw.version < version) return
      set({ display: fromWire(latestRaw), playedVersion: version })
    },

    remember(events) {
      set((current) => ({
        log: [...current.log, { id: logSeq++, kind: 'action', events } as LogEntry].slice(-60),
      }))
    },

    setAnimating(animating) {
      set({ animating })
    },
  }
})

// Accès au store depuis la console du navigateur, en développement uniquement :
// indispensable pour diagnostiquer un décalage entre état autoritaire et affichage.
if (import.meta.env.DEV) {
  ;(window as unknown as { __pb?: typeof useGame }).__pb = useGame
}
