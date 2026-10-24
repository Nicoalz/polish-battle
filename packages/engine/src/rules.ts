import {
  type Action,
  type ApplyResult,
  type Card,
  type GameEvent,
  type GameState,
  type PlayerState,
} from './types'
import { drawCard, drawLifeCards, totalValue } from './cards'
import { nextInt } from './rng'

export const MIN_PLAYERS = 2
export const MAX_PLAYERS = 8
export const INITIAL_LIFE_CARDS = 2
/** Les super-pouvoirs tirent une carte dont la valeur est relevée à ce plancher. */
export const SUPER_POWER_FLOOR = 8

/**
 * Motifs de refus, sous forme de codes stables.
 *
 * Le message porté par l'erreur s'adresse au développeur ; l'interface, elle, traduit
 * le code — c'est ce qui permet d'afficher le refus dans la langue du joueur.
 */
export type IllegalActionCode =
  | 'game-already-started'
  | 'table-full'
  | 'not-enough-players'
  | 'illegal-action'

export class IllegalActionError extends Error {
  readonly code: IllegalActionCode

  constructor(code: IllegalActionCode, message: string) {
    super(message)
    this.name = 'IllegalActionError'
    this.code = code
  }
}

// ---------------------------------------------------------------------------
// Lectures
// ---------------------------------------------------------------------------

export function isAlive(player: PlayerState): boolean {
  return totalValue(player.life) > 0
}

export function findPlayer(state: GameState, playerId: string): PlayerState | undefined {
  return state.players.find((player) => player.id === playerId)
}

export function playerAtSeat(state: GameState, seat: number): PlayerState | undefined {
  return state.players.find((player) => player.seat === seat)
}

export function currentPlayer(state: GameState): PlayerState | undefined {
  return playerAtSeat(state, state.turnSeat)
}

export function alivePlayers(state: GameState): PlayerState[] {
  return state.players.filter(isAlive)
}

export function deadPlayers(state: GameState): PlayerState[] {
  return state.players.filter((player) => !isAlive(player))
}

/**
 * Tout ce que ce joueur a le droit de faire, maintenant.
 *
 * Autorité unique : le serveur refuse ce qui n'y figure pas, et le client grise ses
 * boutons à partir de la même liste. Une seule définition de ce qui est jouable, donc
 * aucune divergence possible entre les deux.
 *
 * La liste ne dépend jamais d'une carte : on choisit son coup sans la connaître.
 */
export function legalActions(state: GameState, playerId: string): Action[] {
  if (state.phase !== 'playing') return []

  const player = findPlayer(state, playerId)
  if (!player || player.seat !== state.turnSeat || !isAlive(player)) return []

  const alive = alivePlayers(state)
  const actions: Action[] = [
    ...alive.map((target): Action => ({ type: 'attack', targetId: target.id })),
    ...alive.map((target): Action => ({ type: 'shield', targetId: target.id })),
    // Une cible qui porte déjà une charge n'est pas proposée : l'action n'aurait
    // aucun effet et gâcherait le tour.
    ...alive
      .filter((target) => !target.battery)
      .map((target): Action => ({ type: 'charge', targetId: target.id })),
  ]

  if (player.hasSuperPower) {
    for (const target of alive) {
      actions.push({ type: 'super-attack', targetId: target.id })
      actions.push({ type: 'super-shield', targetId: target.id })
    }
    for (const target of deadPlayers(state)) {
      actions.push({ type: 'resurrect', targetId: target.id })
    }
  }

  return actions
}

export function isLegal(state: GameState, playerId: string, action: Action): boolean {
  return legalActions(state, playerId).some(
    (candidate) =>
      candidate.type === action.type &&
      ('targetId' in candidate ? candidate.targetId : undefined) ===
        ('targetId' in action ? action.targetId : undefined),
  )
}

// ---------------------------------------------------------------------------
// Cycle de vie de la partie
// ---------------------------------------------------------------------------

export function createGame(seed: number = Date.now()): GameState {
  return { phase: 'lobby', players: [], turnSeat: 0, rng: seed | 0, cardSeq: 0 }
}

function dealPlayer(state: GameState, player: PlayerState): void {
  player.life = drawLifeCards(state, INITIAL_LIFE_CARDS)
  player.shield = drawCard(state)
  player.battery = undefined
  player.hasSuperPower = true
}

/** Un salon accepte des arrivants avant la partie, et de nouveau une fois celle-ci finie. */
export function isOpenToNewPlayers(state: GameState): boolean {
  return state.phase !== 'playing'
}

export function addPlayer(
  state: GameState,
  { id, name }: { id: string; name: string },
): GameState {
  if (!isOpenToNewPlayers(state)) {
    throw new IllegalActionError('game-already-started', 'la partie est en cours')
  }
  if (findPlayer(state, id)) return state
  if (state.players.length >= MAX_PLAYERS) {
    throw new IllegalActionError('table-full', `la table est pleine (${MAX_PLAYERS} joueurs)`)
  }

  const next = structuredClone(state)
  // `dealPlayer` sert la main complète juste après : le bouclier du littéral n'est
  // qu'un provisoire, et le tirer ici gaspillerait une carte et ferait avancer la
  // graine sur une carte que personne ne voit.
  const player: PlayerState = {
    id,
    name,
    seat: next.players.length,
    life: [],
    shield: { id: '', rank: 0, value: 0 },
    hasSuperPower: true,
    connected: true,
    isHost: next.players.length === 0,
  }
  dealPlayer(next, player)
  next.players.push(player)
  return next
}

export function removePlayer(state: GameState, playerId: string): GameState {
  const next = structuredClone(state)
  const leaving = findPlayer(next, playerId)
  if (!leaving) return state

  const wasHost = leaving.isHost
  const wasTheirTurn = leaving.seat === next.turnSeat

  next.players = next.players.filter((player) => player.id !== playerId)
  next.players.forEach((player, index) => {
    player.seat = index
  })
  if (wasHost && next.players[0]) next.players[0].isHost = true

  // La renumérotation décale tout le monde : sans recalage, `turnSeat` désigne un autre
  // joueur que celui qui devait jouer, voire un siège mort, et la table se bloque.
  if (next.players.length === 0) {
    next.turnSeat = 0
  } else {
    if (next.turnSeat >= next.players.length) next.turnSeat = 0
    const atSeat = playerAtSeat(next, next.turnSeat)
    if (wasTheirTurn || !atSeat || !isAlive(atSeat)) {
      next.turnSeat = nextAliveSeat(next, next.turnSeat - 1)
    }
  }
  return next
}

export function setConnected(state: GameState, playerId: string, connected: boolean): GameState {
  const next = structuredClone(state)
  const player = findPlayer(next, playerId)
  if (player) player.connected = connected
  return next
}

export function transferHost(state: GameState, playerId: string): GameState {
  const next = structuredClone(state)
  if (!findPlayer(next, playerId)) return state
  for (const player of next.players) player.isHost = player.id === playerId
  return next
}

/** Démarre ou relance une partie : tout le monde est resservi à neuf. */
export function startGame(state: GameState): ApplyResult {
  if (state.players.length < MIN_PLAYERS) {
    throw new IllegalActionError(
      'not-enough-players',
      `il faut au moins ${MIN_PLAYERS} joueurs`,
    )
  }

  const next = structuredClone(state)
  next.phase = 'playing'
  next.winnerId = undefined
  for (const player of next.players) dealPlayer(next, player)

  // Le siège de départ est tiré au sort. La simulation montre que la position dans
  // l'ordre du tour pèse sur les chances de victoire (le dernier siège est avantagé à
  // 3 joueurs et plus, le premier l'est en duel) : garder un départ fixe reviendrait à
  // pénaliser systématiquement le premier arrivé dans le salon.
  const [seed, startSeat] = nextInt(next.rng, next.players.length)
  next.rng = seed
  next.turnSeat = startSeat

  const events: GameEvent[] = [{ t: 'game-started' }]
  const first = playerAtSeat(next, next.turnSeat)
  if (first) events.push({ t: 'turn-changed', seat: next.turnSeat, playerId: first.id })

  return { state: next, events }
}

// ---------------------------------------------------------------------------
// Résolution
// ---------------------------------------------------------------------------

/**
 * Applique des dégâts à la vie d'un joueur.
 *
 * Les cartes de vie forment une file : la plus ancienne encaisse en premier, et le
 * surplus déborde sur la suivante.
 *
 * **Encaisser fait sauter sa charge.** Un coup entièrement arrêté par le bouclier la
 * laisse intacte — on n'a rien pris — mais dès qu'un point passe, elle est perdue,
 * que la carte de vie survive ou non.
 */
function applyDamage(
  target: PlayerState,
  amount: number,
  events: GameEvent[],
): void {
  if (amount <= 0) return

  if (target.battery) {
    target.battery = undefined
    events.push({ t: 'battery-lost', playerId: target.id, reason: 'broken' })
  }

  let remaining = amount
  while (remaining > 0 && target.life.length > 0) {
    const top = target.life[0]!
    if (remaining >= top.value) {
      remaining -= top.value
      target.life.shift()
      events.push({ t: 'life-destroyed', playerId: target.id, card: top })
    } else {
      const from = top.value
      top.value -= remaining
      remaining = 0
      events.push({
        t: 'life-damaged',
        playerId: target.id,
        cardId: top.id,
        from,
        to: top.value,
      })
    }
  }
}

function resolveAttack(
  attacker: PlayerState,
  target: PlayerState,
  cards: Card[],
  raw: number,
  kind: 'normal' | 'super',
  events: GameEvent[],
): void {
  const shieldValue = target.shield.value
  const dealt = Math.max(0, raw - shieldValue)
  events.push({
    t: 'attack-resolved',
    fromId: attacker.id,
    toId: target.id,
    cards,
    raw,
    shieldValue,
    dealt,
    kind,
  })
  applyDamage(target, dealt, events)
}

function spendBattery(player: PlayerState, events: GameEvent[]): Card | undefined {
  const battery = player.battery
  if (battery) {
    player.battery = undefined
    events.push({ t: 'battery-lost', playerId: player.id, reason: 'spent' })
  }
  return battery
}

function nextAliveSeat(state: GameState, from: number): number {
  const count = state.players.length
  for (let step = 1; step <= count; step++) {
    const seat = (from + step) % count
    const player = playerAtSeat(state, seat)
    if (player && isAlive(player)) return seat
  }
  // Garde-fou : la v1 bouclait à l'infini si plus personne n'était vivant.
  return from
}

/** Constate les morts, désigne un vainqueur, ou passe la main. */
function finalizeTurn(state: GameState, aliveBefore: Set<string>, events: GameEvent[]): void {
  for (const player of state.players) {
    if (!isAlive(player) && aliveBefore.has(player.id)) {
      events.push({ t: 'player-died', playerId: player.id })
    }
  }

  const alive = alivePlayers(state)
  if (alive.length <= 1) {
    state.phase = 'finished'
    const winner = alive[0]
    if (winner) {
      state.winnerId = winner.id
      events.push({ t: 'game-won', playerId: winner.id })
    }
    return
  }

  state.turnSeat = nextAliveSeat(state, state.turnSeat)
  const next = playerAtSeat(state, state.turnSeat)
  if (next) events.push({ t: 'turn-changed', seat: state.turnSeat, playerId: next.id })
}

/**
 * Carte tirée par un super-pouvoir : sa valeur est relevée au plancher.
 *
 * Le rang suit la valeur. Sans cela, une super-carte tirée sur la carte maudite
 * garderait un rang nul et serait dessinée comme maudite alors qu'elle vaut 8.
 */
function drawSuperCard(state: GameState): Card {
  const card = drawCard(state)
  if (card.value < SUPER_POWER_FLOOR) {
    card.value = SUPER_POWER_FLOOR
    card.rank = SUPER_POWER_FLOOR
  }
  return card
}

// ---------------------------------------------------------------------------
// Transition
// ---------------------------------------------------------------------------

export function applyAction(state: GameState, playerId: string, action: Action): ApplyResult {
  if (!isLegal(state, playerId, action)) {
    throw new IllegalActionError(
      'illegal-action',
      `action « ${action.type} » impossible pour ${playerId}`,
    )
  }

  const next = structuredClone(state)
  const events: GameEvent[] = []
  const player = findPlayer(next, playerId)!
  const aliveBefore = new Set(alivePlayers(next).map((p) => p.id))
  const target =
    'targetId' in action ? findPlayer(next, action.targetId)! : undefined

  switch (action.type) {
    case 'attack': {
      // La carte se tire maintenant, le coup étant déjà engagé.
      const drawn = drawCard(next)
      const battery = player.battery
      const raw = drawn.value + (battery?.value ?? 0)
      events.push({ t: 'drawn', playerId, card: drawn })
      resolveAttack(player, target!, battery ? [drawn, battery] : [drawn], raw, 'normal', events)
      spendBattery(player, events)
      break
    }

    case 'shield': {
      const drawn = drawCard(next)
      target!.shield = drawn
      events.push({ t: 'drawn', playerId, card: drawn })
      events.push({
        t: 'shield-set',
        playerId: target!.id,
        byId: playerId,
        card: drawn,
        kind: 'normal',
      })
      break
    }

    case 'charge': {
      // Aucun événement de révélation : une charge se pose sans jamais se montrer.
      const drawn = drawCard(next)
      target!.battery = drawn
      events.push({ t: 'battery-set', playerId: target!.id, byId: playerId, card: drawn })
      break
    }

    case 'super-attack': {
      const card = drawSuperCard(next)
      const battery = player.battery
      const raw = card.value + (battery?.value ?? 0)
      player.hasSuperPower = false
      events.push({ t: 'super-used', playerId, kind: 'super-attack' })
      events.push({ t: 'drawn', playerId, card })
      resolveAttack(player, target!, battery ? [card, battery] : [card], raw, 'super', events)
      // La super-attaque vide la batterie de la cible quoi qu'il arrive, même si aucune
      // carte de vie n'a été détruite.
      if (target!.battery) {
        target!.battery = undefined
        events.push({ t: 'battery-lost', playerId: target!.id, reason: 'broken' })
      }
      // Correction v2 : elle consomme aussi celle de l'attaquant, comme l'attaque normale.
      spendBattery(player, events)
      break
    }

    case 'super-shield': {
      const card = drawSuperCard(next)
      player.hasSuperPower = false
      target!.shield = card
      events.push({ t: 'super-used', playerId, kind: 'super-shield' })
      events.push({ t: 'drawn', playerId, card })
      events.push({
        t: 'shield-set',
        playerId: target!.id,
        byId: playerId,
        card,
        kind: 'super',
      })
      break
    }

    case 'resurrect': {
      player.hasSuperPower = false
      // Le ressuscité perd aussi le sien : la résurrection coûte deux super-pouvoirs.
      target!.hasSuperPower = false
      target!.life = drawLifeCards(next, 1)
      target!.shield = drawCard(next)
      events.push({ t: 'super-used', playerId, kind: 'resurrect' })
      events.push({ t: 'resurrected', playerId: target!.id, byId: playerId })
      break
    }
  }

  finalizeTurn(next, aliveBefore, events)
  return { state: next, events }
}

/**
 * Passe la main de force (pouvoir d'hôte, ou joueur déconnecté qui fait attendre la table).
 * La carte éventuellement piochée est perdue.
 */
export function skipTurn(state: GameState): ApplyResult {
  if (state.phase !== 'playing') return { state, events: [] }

  const next = structuredClone(state)
  const events: GameEvent[] = []
  finalizeTurn(next, new Set(alivePlayers(next).map((p) => p.id)), events)
  return { state: next, events }
}
