import { drawCard } from '../src/cards'
import type { Card, GameState, PlayerState } from '../src/types'

let sequence = 0

/** Carte de test : la valeur est ce qui compte, le rang suit sauf mention contraire. */
export function card(value: number, options: { rank?: number; id?: string } = {}): Card {
  return {
    id: options.id ?? `t${sequence++}`,
    rank: options.rank ?? value,
    value,
  }
}

/** La carte maudite : rang 0, donc valeur 0 dans tous ses rôles. */
export function cursed(): Card {
  return { id: `t${sequence++}`, rank: 0, value: 0 }
}

export function player(
  id: string,
  seat: number,
  overrides: Partial<PlayerState> = {},
): PlayerState {
  return {
    id,
    name: id.toUpperCase(),
    avatar: '🦊',
    seat,
    life: [card(5), card(5)],
    shield: cursed(), // bouclier à 0 par défaut : les attaques passent entièrement
    hasSuperPower: true,
    connected: true,
    isHost: seat === 0,
    ...overrides,
  }
}

export function game(players: PlayerState[], overrides: Partial<GameState> = {}): GameState {
  return {
    phase: 'playing',
    players,
    turnSeat: 0,
    rng: 12345,
    cardSeq: 1000,
    ...overrides,
  }
}

/** Raccourci : une table de deux joueurs, au tour du premier. */
export function duel(
  a: Partial<PlayerState> = {},
  b: Partial<PlayerState> = {},
): GameState {
  return game([player('a', 0, a), player('b', 1, b)])
}

export function lifeValues(state: GameState, playerId: string): number[] {
  return state.players.find((p) => p.id === playerId)!.life.map((c) => c.value)
}

const seeds = new Map<number, number>()

/**
 * Graine dont le prochain tirage donne exactement cette valeur.
 *
 * Un coup se jouant désormais sans connaître sa carte, un test ne peut plus poser la
 * carte à l'avance : il règle l'aléa pour que le tirage tombe où il veut.
 */
export function seedFor(value: number): number {
  const cached = seeds.get(value)
  if (cached !== undefined) return cached

  for (let seed = 1; seed < 100_000; seed++) {
    if (drawCard({ rng: seed, cardSeq: 0 } as GameState).value === value) {
      seeds.set(value, seed)
      return seed
    }
  }
  throw new Error(`aucune graine ne produit la valeur ${value}`)
}

/** Duel dont le prochain tirage vaudra `value`. */
export function duelDrawing(
  value: number,
  a: Partial<PlayerState> = {},
  b: Partial<PlayerState> = {},
): GameState {
  const state = duel(a, b)
  state.rng = seedFor(value)
  return state
}

/** Table dont le prochain tirage vaudra `value`. */
export function drawing(value: number, state: GameState): GameState {
  state.rng = seedFor(value)
  return state
}
