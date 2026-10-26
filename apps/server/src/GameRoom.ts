import { Room, type Client, type Delayed } from '@colyseus/core'
import {
  IllegalActionError,
  MAX_PLAYERS,
  ABSENT_TURN_LIMIT_MS,
  TURN_LIMIT_MS,
  addPlayer,
  hiddenCard,
  isOpenToNewPlayers,
  applyAction,
  createGame,
  currentPlayer,
  findPlayer,
  removePlayer,
  setConnected,
  setOptions,
  skipTurn,
  startGame,
  transferHost,
  type Action,
  type ActionType,
  type GameEvent,
  type GameState,
} from '@pb/engine'
import { GameSchema } from './schema'
import { syncState } from './sync'

/** Délai de reconnexion avant de libérer définitivement un joueur parti. */
const RECONNECTION_WINDOW_SECONDS = 60

const ACTION_TYPES: ReadonlySet<string> = new Set<ActionType>([
  'attack',
  'shield',
  'charge',
  'super-attack',
  'super-shield',
  'resurrect',
])

type JoinOptions = {
  code?: string
  playerId?: string
  name?: string
  avatar?: string
  /** Un salon public apparaît dans la liste de la page d'accueil ; un privé, jamais. */
  visibility?: 'public' | 'private'
}

/** Ce qu'un salon annonce de lui-même avant qu'on y entre. */
export type RoomSummary = {
  code: string
  players: number
  phase: string
  /** Faux pour un salon privé : il n'apparaît alors dans aucune liste. */
  listed: boolean
}

/**
 * Salon de jeu autoritaire.
 *
 * La room ne connaît aucune règle : elle traduit des messages en actions, demande au
 * moteur de les appliquer, et diffuse le résultat. L'identité de l'acteur vient
 * toujours de la session, jamais d'un index envoyé par le client — c'est ce qui rend
 * la triche de la v1 structurellement impossible.
 */
export class GameRoom extends Room<GameSchema> {
  override maxClients = MAX_PLAYERS

  private game: GameState = createGame()
  private readonly seatBySession = new Map<string, string>()
  private skipTimer?: Delayed
  private announced?: string
  private listed = false

  override onCreate(options: JoinOptions): void {
    const state = new GameSchema()
    state.code = normalizeCode(options.code)
    this.setState(state)

    this.onMessage('start', (client) => this.handleStart(client))
    this.onMessage('restart', (client) => this.handleRestart(client))
    this.onMessage('skip', (client) => this.handleHostSkip(client))
    this.onMessage('kick', (client, message) => this.handleKick(client, message))
    this.onMessage('options', (client, message) => this.handleOptions(client, message))
    this.onMessage('action', (client, message) => this.handleAction(client, message))

    // On ne marque surtout pas le salon privé au sens de Colyseus : cela le retirerait
    // du matchmaking, et personne ne pourrait plus le rejoindre par son code — chacun
    // créerait silencieusement le sien. « Privé » veut seulement dire : absent de la
    // liste. Le code reste l'unique porte d'entrée, et aucune route ne permet à un
    // client d'énumérer les salons.
    this.listed = options.visibility === 'public'

    this.commit([])
  }

  override async onJoin(client: Client, options: JoinOptions = {}): Promise<void> {
    const playerId = options.playerId?.trim()
    if (!playerId) throw new Error('identifiant de joueur manquant')

    const existing = findPlayer(this.game, playerId)
    if (existing) {
      // Reprise de siège : on retrouve sa place, ses cartes et son tour.
      this.game = setConnected(this.game, playerId, true)
    } else {
      if (!isOpenToNewPlayers(this.game)) throw new Error('la partie est en cours')
      this.game = addPlayer(this.game, {
        id: playerId,
        name: sanitizeName(options.name),
        // `addPlayer` ramène de lui-même toute valeur inconnue à un avatar valide.
        avatar: options.avatar,
      })
    }

    this.seatBySession.set(client.sessionId, playerId)
    this.commit([])
  }

  override async onLeave(client: Client, consented?: boolean): Promise<void> {
    const playerId = this.seatBySession.get(client.sessionId)
    if (!playerId) return

    this.seatBySession.delete(client.sessionId)
    this.game = setConnected(this.game, playerId, false)
    this.commit([])

    if (!consented && this.game.phase === 'playing') {
      try {
        await this.allowReconnection(client, RECONNECTION_WINDOW_SECONDS)
        this.seatBySession.set(client.sessionId, playerId)
        this.game = setConnected(this.game, playerId, true)
        this.commit([])
        return
      } catch {
        // Fenêtre de reconnexion écoulée : on laisse le siège en place, cartes comprises,
        // pour ne pas décaler l'ordre du tour au milieu d'une partie.
        return
      }
    }

    // Hors partie en cours, un départ libère vraiment la place. Sans cela, un joueur
    // parti pendant l'écran de victoire resterait servi à la relance, et sa place
    // ferait attendre la table trente secondes à chaque tour.
    if (isOpenToNewPlayers(this.game)) {
      this.game = removePlayer(this.game, playerId)
      this.commit([])
    }
  }

  // -------------------------------------------------------------------------
  // Messages
  // -------------------------------------------------------------------------

  private handleStart(client: Client): void {
    if (!this.requireHost(client)) return
    if (this.game.phase === 'playing') return
    this.run(client, () => startGame(this.game))
  }

  private handleRestart(client: Client): void {
    if (!this.requireHost(client)) return
    this.run(client, () => startGame(this.game))
  }

  private handleHostSkip(client: Client): void {
    if (!this.requireHost(client)) return
    this.run(client, () => skipTurn(this.game))
  }

  /**
   * Règle une option de partie.
   *
   * Aucun événement n'en sort : un réglage n'est pas un coup, il n'a rien à raconter.
   * L'état suffit, et il part dans la foulée par la synchro habituelle.
   */
  private handleOptions(client: Client, message: unknown): void {
    if (!this.requireHost(client)) return
    if (typeof message !== 'object' || message === null) return
    this.run(client, () => ({ state: setOptions(this.game, message), events: [] }))
  }

  private handleKick(client: Client, message: unknown): void {
    if (!this.requireHost(client)) return
    // Exclure quelqu'un en pleine partie renumérote les sièges sous les pieds des
    // joueurs : on ne l'autorise qu'entre deux manches.
    if (!isOpenToNewPlayers(this.game)) {
      client.send('rejected', { code: 'not-during-game' })
      return
    }
    const targetId = readString(message, 'playerId')
    if (!targetId || targetId === this.playerIdOf(client)) return

    const target = findPlayer(this.game, targetId)
    if (!target) return

    this.game = removePlayer(this.game, targetId)
    for (const [sessionId, playerId] of this.seatBySession) {
      if (playerId !== targetId) continue
      this.seatBySession.delete(sessionId)
      this.clients.find((c) => c.sessionId === sessionId)?.leave(4000)
    }
    this.commit([])
  }

  private handleAction(client: Client, message: unknown): void {
    const playerId = this.playerIdOf(client)
    if (!playerId) return

    const action = parseAction(message)
    if (!action) {
      client.send('rejected', { code: 'unknown-action' })
      return
    }

    this.run(client, () => applyAction(this.game, playerId, action))
  }

  // -------------------------------------------------------------------------
  // Plomberie
  // -------------------------------------------------------------------------

  /** Applique une transition du moteur, ou renvoie poliment le refus au client. */
  private run(
    client: Client,
    transition: () => { state: GameState; events: GameEvent[] },
  ): void {
    try {
      const result = transition()
      this.game = result.state
      this.commit(result.events)
    } catch (error) {
      if (error instanceof IllegalActionError) {
        // On envoie un code, pas une phrase : c'est le client qui le traduit.
        client.send('rejected', { code: error.code })
        return
      }
      throw error
    }
  }

  /** Publie le nouvel état et le récit de ce qui vient de se passer. */
  private commit(events: GameEvent[]): void {
    this.ensureReachableHost()
    syncState(this.state, this.game)
    this.announce()

    if (events.length > 0) {
      this.state.version += 1
      this.broadcast('events', { version: this.state.version, events: redact(events) })
    }

    this.refreshSkipTimer()
  }

  /**
   * Publie de quoi présenter le salon dans la liste, sans y entrer.
   *
   * Seuls le code, l'effectif et l'état circulent : de quoi choisir une table, rien de
   * ce qui s'y joue. On ne republie que lorsque quelque chose a bougé.
   */
  private announce(): void {
    const summary: RoomSummary = {
      code: this.state.code,
      players: this.game.players.length,
      phase: this.game.phase,
      listed: this.listed,
    }
    const signature = `${summary.code}|${summary.players}|${summary.phase}|${summary.listed}`
    if (this.announced === signature) return

    this.announced = signature
    void this.setMetadata(summary)
  }

  /**
   * Le rôle d'hôte doit toujours être tenu par quelqu'un de présent.
   *
   * Il n'était transmis qu'au départ définitif d'un joueur, ce qui n'arrive pas en pleine
   * partie : un hôte dont le téléphone meurt emportait avec lui les seuls moyens de
   * relancer ou de débloquer la table.
   */
  private ensureReachableHost(): void {
    const host = this.game.players.find((player) => player.isHost)
    if (host?.connected) return

    const present = this.game.players.find((player) => player.connected)
    if (present && present.id !== host?.id) {
      this.game = transferHost(this.game, present.id)
    }
  }

  /**
   * Aucun tour ne dure indéfiniment.
   *
   * Un onglet fermé ne fait attendre que quelques secondes ; un joueur bien présent mais
   * parti chercher à boire a droit à plus de temps, mais pas à l'éternité. Sans ce délai,
   * seul l'hôte pouvait débloquer la table — et il lui arrive d'être justement l'absent.
   */
  private refreshSkipTimer(): void {
    this.skipTimer?.clear()
    this.skipTimer = undefined

    if (this.game.phase !== 'playing') return
    const player = currentPlayer(this.game)
    if (!player) return

    const limit = player.connected ? TURN_LIMIT_MS : ABSENT_TURN_LIMIT_MS
    this.skipTimer = this.clock.setTimeout(() => {
      const result = skipTurn(this.game)
      this.game = result.state
      this.commit(result.events)
    }, limit)
  }

  private playerIdOf(client: Client): string | undefined {
    return this.seatBySession.get(client.sessionId)
  }

  private requireHost(client: Client): boolean {
    const playerId = this.playerIdOf(client)
    const player = playerId ? findPlayer(this.game, playerId) : undefined
    if (player?.isHost) return true
    client.send('rejected', { code: 'host-only' })
    return false
  }

  override onDispose(): void {
    this.skipTimer?.clear()
  }
}

/**
 * Retire du récit ce que personne n'a à savoir.
 *
 * Un coup se jouant à l'aveugle, aucune carte n'est détenue : il n'y a plus de pioche à
 * cacher, et les cartes d'attaque ou de bouclier sont publiques par nature. Reste la
 * charge, posée face cachée, dont la valeur ne doit pas transiter — le moteur l'annonce
 * franchement, c'est au transport de la taire.
 */
function redact(events: GameEvent[]): GameEvent[] {
  return events.map((event) =>
    event.t === 'battery-set'
      ? { ...event, card: hiddenCard('battery', event.playerId) }
      : event,
  )
}

// ---------------------------------------------------------------------------
// Validation des entrées
// ---------------------------------------------------------------------------

function parseAction(message: unknown): Action | undefined {
  const type = readString(message, 'type')
  if (!type || !ACTION_TYPES.has(type)) return undefined

  // Tout coup vise quelqu'un : il n'existe plus d'action sans cible.
  const targetId = readString(message, 'targetId')
  if (!targetId) return undefined
  return { type, targetId } as Action
}

function readString(message: unknown, key: string): string | undefined {
  if (typeof message !== 'object' || message === null) return undefined
  const value = (message as Record<string, unknown>)[key]
  return typeof value === 'string' && value.length > 0 ? value : undefined
}

function sanitizeName(name: string | undefined): string {
  const trimmed = (name ?? '').trim().replace(/\s+/g, ' ').slice(0, 16)
  return trimmed || 'Joueur'
}

function normalizeCode(code: string | undefined): string {
  return (code ?? '').trim().toUpperCase().slice(0, 8)
}
