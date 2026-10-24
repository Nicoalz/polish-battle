/**
 * Simulateur d'équilibrage.
 *
 * Joue des milliers de parties avec la politique de `ai.ts` et mesure ce qu'on ne peut
 * pas deviner à la lecture des règles : est-ce qu'une partie se termine toujours ?
 * combien de tours dure-t-elle ? le premier joueur est-il avantagé ?
 *
 * C'est la vérification chiffrée du choix « bouclier permanent » : si des parties se
 * bloquent derrière deux gros boucliers, ça se verra ici.
 *
 *   pnpm sim                      → 2 000 parties par effectif, de 2 à 8 joueurs
 *   pnpm sim --games 10000        → plus de parties
 *   pnpm sim --players 2          → un seul effectif
 */
import { addPlayer, applyAction, createGame, currentPlayer, skipTurn, startGame } from './rules'
import { chooseAction } from './ai'
import { nextFloat } from './rng'
import type { GameState } from './types'

/** Au-delà, on considère que la partie ne se terminera jamais. */
const ACTION_CAP = 4000

type GameOutcome = {
  finished: boolean
  turns: number
  winnerSeat: number | undefined
}

function playGame(playerCount: number, seed: number): GameOutcome {
  let state: GameState = createGame(seed)
  for (let i = 0; i < playerCount; i++) {
    state = addPlayer(state, { id: `p${i}`, name: `J${i + 1}` })
  }
  state = startGame(state).state

  // Aléatoire propre à l'IA, distinct de celui du moteur, mais tout aussi reproductible.
  let policySeed = seed ^ 0x5f3759df
  const random = () => {
    const [next, value] = nextFloat(policySeed)
    policySeed = next
    return value
  }

  let turns = 0
  let actions = 0

  while (state.phase === 'playing' && actions < ACTION_CAP) {
    const player = currentPlayer(state)
    if (!player) break
    const action = chooseAction(state, player.id, random)
    if (!action) {
      state = skipTurn(state).state
      turns++
      continue
    }
    const result = applyAction(state, player.id, action)
    state = result.state
    turns += result.events.filter((event) => event.t === 'turn-changed').length
    actions++
  }

  const winner = state.winnerId
    ? state.players.find((player) => player.id === state.winnerId)
    : undefined

  return { finished: state.phase === 'finished', turns, winnerSeat: winner?.seat }
}

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const index = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))
  return sorted[index]!
}

function run(playerCount: number, games: number, baseSeed: number) {
  const turns: number[] = []
  const winsBySeat = new Array<number>(playerCount).fill(0)
  let unfinished = 0

  for (let i = 0; i < games; i++) {
    const outcome = playGame(playerCount, baseSeed + i * 7919)
    if (!outcome.finished) {
      unfinished++
      continue
    }
    turns.push(outcome.turns)
    if (outcome.winnerSeat !== undefined) winsBySeat[outcome.winnerSeat]!++
  }

  const finished = games - unfinished
  const average = turns.length ? turns.reduce((a, b) => a + b, 0) / turns.length : 0
  const expected = 100 / playerCount
  const spread = winsBySeat.map((wins) => (finished ? (wins / finished) * 100 : 0))
  const maxDeviation = Math.max(...spread.map((rate) => Math.abs(rate - expected)))

  return {
    playerCount,
    games,
    unfinishedRate: (unfinished / games) * 100,
    averageTurns: average,
    medianTurns: percentile(turns, 50),
    p95Turns: percentile(turns, 95),
    maxTurns: turns.length ? Math.max(...turns) : 0,
    seatWinRates: spread,
    maxDeviation,
  }
}

function parseArg(name: string, fallback: number): number {
  const index = process.argv.indexOf(`--${name}`)
  if (index === -1) return fallback
  const value = Number(process.argv[index + 1])
  return Number.isFinite(value) ? value : fallback
}

const games = parseArg('games', 2000)
const onlyPlayers = parseArg('players', 0)
const seed = parseArg('seed', 20261024)
const counts = onlyPlayers ? [onlyPlayers] : [2, 3, 4, 5, 6, 8]

console.log(`\nPolish Battle — simulation d'équilibrage (${games} parties par effectif)\n`)
console.log('  n   parties   non finies   tours moy.   médiane   p95   max   écart sièges')
console.log('  ──  ────────  ───────────  ──────────  ────────  ────  ────  ─────────────')

const detail = process.argv.includes('--detail')
let worstUnfinished = 0
for (const playerCount of counts) {
  const stats = run(playerCount, games, seed)
  worstUnfinished = Math.max(worstUnfinished, stats.unfinishedRate)
  console.log(
    `  ${String(playerCount).padStart(2)}  ${String(stats.games).padStart(8)}  ` +
      `${(stats.unfinishedRate.toFixed(2) + ' %').padStart(11)}  ` +
      `${stats.averageTurns.toFixed(1).padStart(10)}  ` +
      `${String(stats.medianTurns).padStart(8)}  ` +
      `${String(stats.p95Turns).padStart(4)}  ` +
      `${String(stats.maxTurns).padStart(4)}  ` +
      `${('±' + stats.maxDeviation.toFixed(1) + ' pt').padStart(13)}`,
  )
  if (detail) {
    const rates = stats.seatWinRates
      .map((rate, seat) => `siège ${seat + 1} ${rate.toFixed(1)} %`)
      .join('   ')
    console.log(`      ${rates}   (équité = ${(100 / playerCount).toFixed(1)} %)`)
  }
}

console.log('')
if (worstUnfinished > 0.5) {
  console.log(
    `  ⚠  ${worstUnfinished.toFixed(2)} % de parties non terminées : le bouclier permanent bloque des parties.`,
  )
} else {
  console.log('  ✓  Toutes les parties se terminent : le bouclier permanent ne bloque pas le jeu.')
}
console.log("  « écart sièges » = écart maximal au taux de victoire attendu si les places étaient équitables.\n")
