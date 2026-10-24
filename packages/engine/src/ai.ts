import { legalActions, isAlive, findPlayer, alivePlayers } from './rules'
import { totalValue } from './cards'
import type { Action, GameState, PlayerState } from './types'

/**
 * Politique de jeu simple et non dégénérée.
 *
 * Elle sert au simulateur d'équilibrage et constitue la base d'éventuels bots jouables.
 * Comme un joueur humain, elle décide **sans connaître sa carte** : elle ne peut que
 * miser sur ce qu'un tirage vaut en moyenne.
 *
 * Les égalités sont tranchées au hasard et non par ordre de siège : départager toujours
 * dans le même sens ferait d'un détail d'implémentation un biais de position, et
 * fausserait précisément ce que le simulateur cherche à mesurer.
 */

/**
 * Valeur moyenne d'un tirage : 0 une fois sur 52, 13 trois fois, et 1 à 12 quatre fois
 * chacune, soit 351/52.
 */
export const EXPECTED_CARD = 6.75

export function chooseAction(
  state: GameState,
  playerId: string,
  random: () => number = Math.random,
): Action | undefined {
  const actions = legalActions(state, playerId)
  if (actions.length === 0) return undefined

  const me = findPlayer(state, playerId)
  if (!me) return actions[0]

  const opponents = alivePlayers(state).filter((player) => player.id !== playerId)
  const pick = (action: Action | undefined): Action | undefined =>
    action && actions.some((a) => sameAction(a, action)) ? action : undefined

  if (me.hasSuperPower) {
    // Coup de grâce : la super-attaque garantit au moins 8, c'est le seul coup dont on
    // connaisse le plancher à l'avance.
    const finishers = opponents.filter(
      (opponent) =>
        8 + (me.battery?.value ?? 0) - opponent.shield.value >= totalValue(opponent.life),
    )
    const finisher = sample(finishers, random)
    if (finisher) {
      const superAttack = pick({ type: 'super-attack', targetId: finisher.id })
      if (superAttack) return superAttack
    }
    // Dos au mur et sans bouclier : on prend le seul bouclier dont la valeur est sûre.
    if (me.shield.value <= 1 && totalValue(me.life) <= 6) {
      const superShield = pick({ type: 'super-shield', targetId: playerId })
      if (superShield) return superShield
    }
  }

  const power = EXPECTED_CARD + (me.battery?.value ?? 0)
  const best = bestTarget(opponents, power, random)

  // À découvert : un bouclier tiré au hasard vaut en moyenne mieux que celui qu'on a.
  if (me.shield.value + 2 < EXPECTED_CARD) {
    const shieldSelf = pick({ type: 'shield', targetId: playerId })
    if (shieldSelf) return shieldSelf
  }

  // Taper ne mènerait à rien : on capitalise plutôt sur le tour suivant.
  if (!me.battery && (!best || best.dealt <= 0)) {
    const chargeSelf = pick({ type: 'charge', targetId: playerId })
    if (chargeSelf) return chargeSelf
  }

  if (best) {
    const attack = pick({ type: 'attack', targetId: best.player.id })
    if (attack) return attack
  }

  return pick({ type: 'shield', targetId: playerId }) ?? actions[0]
}

/** Meilleure cible : dégâts espérés les plus élevés, puis la plus proche de l'élimination. */
function bestTarget(
  opponents: PlayerState[],
  power: number,
  random: () => number,
): { player: PlayerState; dealt: number } | undefined {
  let tied: { player: PlayerState; dealt: number }[] = []
  let bestDealt = -1
  let bestLife = Number.POSITIVE_INFINITY

  for (const player of opponents) {
    if (!isAlive(player)) continue
    const dealt = Math.max(0, power - player.shield.value)
    const life = totalValue(player.life)

    if (dealt > bestDealt || (dealt === bestDealt && life < bestLife)) {
      bestDealt = dealt
      bestLife = life
      tied = [{ player, dealt }]
    } else if (dealt === bestDealt && life === bestLife) {
      tied.push({ player, dealt })
    }
  }

  return sample(tied, random)
}

function sample<T>(items: T[], random: () => number): T | undefined {
  if (items.length === 0) return undefined
  return items[Math.floor(random() * items.length)]
}

function sameAction(a: Action, b: Action): boolean {
  if (a.type !== b.type) return false
  const at = 'targetId' in a ? a.targetId : undefined
  const bt = 'targetId' in b ? b.targetId : undefined
  return at === bt
}
