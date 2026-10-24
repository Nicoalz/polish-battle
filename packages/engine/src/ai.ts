import { legalActions, isAlive, findPlayer, alivePlayers } from './rules'
import { totalValue } from './cards'
import type { Action, GameState, PlayerState } from './types'

/**
 * Politique de jeu simple et non dégénérée.
 *
 * Elle sert au simulateur d'équilibrage et constitue la base d'éventuels bots jouables.
 * Elle ne cherche pas à bien jouer, seulement à jouer de façon plausible : taper qui
 * fait le plus mal, se protéger quand on est à découvert, charger quand la carte est
 * trop belle pour être dépensée tout de suite.
 *
 * Les égalités sont tranchées **au hasard** et non par ordre de siège : départager
 * toujours dans le même sens ferait d'un détail d'implémentation un biais de position,
 * et fausserait précisément ce que le simulateur cherche à mesurer.
 */
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

  if (me.drawn) {
    const power = me.drawn.value + (me.battery?.value ?? 0)
    const best = bestTarget(opponents, power, random)

    // À découvert avec une carte solide : on se blinde plutôt que de taper dans le vide.
    if (me.shield.value <= 2 && me.drawn.value >= 8) {
      const shieldSelf = pick({ type: 'shield', targetId: playerId })
      if (shieldSelf) return shieldSelf
    }
    // Carte trop précieuse pour être dépensée seule : on la met de côté.
    if (!me.battery && me.drawn.value >= 10) {
      const chargeSelf = pick({ type: 'charge', targetId: playerId })
      if (chargeSelf) return chargeSelf
    }
    if (best && best.dealt > 0) {
      const attack = pick({ type: 'attack', targetId: best.player.id })
      if (attack) return attack
    }
    // Aucune attaque ne passe : on renforce son propre bouclier.
    const fallback =
      pick({ type: 'shield', targetId: playerId }) ??
      pick({ type: 'charge', targetId: playerId }) ??
      (best ? pick({ type: 'attack', targetId: best.player.id }) : undefined)
    if (fallback) return fallback
    return actions[0]
  }

  if (me.hasSuperPower) {
    // Coup de grâce : la super-attaque garantit au moins 8.
    const finishers = opponents.filter(
      (opponent) =>
        8 + (me.battery?.value ?? 0) - opponent.shield.value >= totalValue(opponent.life),
    )
    const finisher = sample(finishers, random)
    if (finisher) {
      const superAttack = pick({ type: 'super-attack', targetId: finisher.id })
      if (superAttack) return superAttack
    }
    // Dos au mur et sans bouclier : on se blinde.
    if (me.shield.value <= 1 && totalValue(me.life) <= 6) {
      const superShield = pick({ type: 'super-shield', targetId: playerId })
      if (superShield) return superShield
    }
  }

  return pick({ type: 'draw' }) ?? actions[0]
}

/** Meilleure cible : dégâts les plus élevés, puis la plus proche de l'élimination. */
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
