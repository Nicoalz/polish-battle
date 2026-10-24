import { create } from 'zustand'
import { Client, type Room } from 'colyseus.js'
import type { Action, GameEvent, GameState } from '@pb/engine'
import { fromWire, type WireGame } from '@pb/engine'
import { getPlayerId, saveName } from './identity'
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

/** Fenêtre pendant laquelle on retente de reprendre la partie après une coupure. */
const RECONNECT_ATTEMPTS = 20
const RECONNECT_DELAY_MS = 3000

export type ConnectionStatus = 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'error'

/**
 * Un lot d'événements, avec la version d'état qu'il produit.
 *
 * La version est indispensable : la diffusion des événements et le correctif d'état
 * voyagent par deux canaux distincts, et les événements arrivent presque toujours les
 * premiers. Valider l'affichage sans attendre reviendrait à afficher l'état d'avant.
 */
export type Batch = { version: number; events: GameEvent[] }

/**
 * Le journal conserve les événements bruts, pas des phrases : la mise en mots a lieu
 * à l'affichage, donc changer de langue retraduit aussi l'historique.
 */
export type LogEntry =
  | { id: number; kind: 'event'; event: GameEvent }
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

  connect: (code: string, name: string) => Promise<void>
  leave: () => Promise<void>
  send: (action: Action) => void
  command: (type: 'start' | 'restart' | 'skip') => void
  kick: (playerId: string) => void

  /** Retire le prochain lot à jouer, ou `undefined` s'il n'y a plus rien en attente. */
  consume: () => Batch | undefined
  /** Fait rattraper à l'affichage l'état produit par le lot `version`. */
  commit: (version: number) => void
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
      set((current) => ({
        queue: [...current.queue, { version: payload.version, events: payload.events }],
        log: [
          ...current.log,
          ...payload.events.map((event): LogEntry => ({ id: logSeq++, kind: 'event', event })),
        ].slice(-60),
      }))
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

    async connect(code, name) {
      if (get().status === 'connecting') return
      set({ status: 'connecting', error: undefined })
      saveName(name)

      const target = code.trim().toUpperCase()
      try {
        const client = new Client(SERVER_URL)
        attach(
          await client.joinOrCreate('game', { code: target, playerId: get().playerId, name }),
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
      })
    },

    send(action) {
      room?.send('action', action)
    },

    command(type) {
      room?.send(type)
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
