import { Room, type Client, type Delayed } from '@colyseus/core'
import {
  IllegalActionError,
  MAX_PLAYERS,
  addPlayer,
  hiddenCard,
  isOpenToNewPlayers,
  applyAction,
  createGame,
  currentPlayer,
  findPlayer,
  removePlayer,
  setConnected,
  skipTurn,
  startGame,
  type Action,
  type ActionType,
  type GameEvent,
  type GameState,
} from '@pb/engine'
import { GameSchema } from './schema'
import { syncState } from './sync'

/** Délai de reconnexion avant de libérer définitivement un joueur parti. */
const RECONNECTION_WINDOW_SECONDS = 60
/** Au-delà, le tour d'un joueur déconnecté est passé pour ne pas bloquer la table. */
const DISCONNECTED_TURN_MS = 30_000

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

  override onCreate(options: JoinOptions): void {
    const state = new GameSchema()
    state.code = normalizeCode(options.code)
    this.setState(state)

    this.onMessage('start', (client) => this.handleStart(client))
    this.onMessage('restart', (client) => this.handleRestart(client))
    this.onMessage('skip', (client) => this.handleHostSkip(client))
    this.onMessage('kick', (client, message) => this.handleKick(client, message))
    this.onMessage('action', (client, message) => this.handleAction(client, message))

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
      this.game = addPlayer(this.game, { id: playerId, name: sanitizeName(options.name) })
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
    syncState(this.state, this.game)

    if (events.length > 0) {
      this.state.version += 1
      this.broadcast('events', { version: this.state.version, events: redact(events) })
    }

    this.refreshSkipTimer()
  }

  /**
   * Un joueur déconnecté ne doit pas geler la table : au bout d'un moment, son tour
   * passe tout seul. C'est le bug n°12 de la v1, où un onglet fermé bloquait la partie.
   */
  private refreshSkipTimer(): void {
    this.skipTimer?.clear()
    this.skipTimer = undefined

    if (this.game.phase !== 'playing') return
    const player = currentPlayer(this.game)
    if (!player || player.connected) return

    this.skipTimer = this.clock.setTimeout(() => {
      const result = skipTurn(this.game)
      this.game = result.state
      this.commit(result.events)
    }, DISCONNECTED_TURN_MS)
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
