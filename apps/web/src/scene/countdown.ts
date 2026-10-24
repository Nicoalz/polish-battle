import type { Card } from '@pb/engine'

/**
 * Descente des cartes de vie, valeur par valeur.
 *
 * Le moteur passe d'un coup de 7 à 3 : c'est la vérité du jeu, mais à l'écran le chiffre
 * changerait sans qu'on voie rien. On rapproche donc l'affichage de la vérité un point à
 * la fois, et une carte détruite reste en place le temps de s'éteindre avant de
 * disparaître.
 *
 * Fonctions pures, sans React ni navigateur : c'est ce qui les rend testables.
 */

/** Intervalle entre deux pas. */
export const TICK_MS = 95
/** Au-delà de cet écart, on descend deux par deux : un 13 ne doit pas durer une seconde. */
export const BIG_DROP = 8

/**
 * Avance l'affichage d'un pas vers la cible.
 *
 * Renvoie la liste inchangée — la même référence — quand il n'y a plus rien à faire :
 * c'est ce qui arrête la boucle d'animation.
 */
export function stepTowards(shown: Card[], target: Card[]): Card[] {
  const wanted = new Map(target.map((card) => [card.id, card]))
  const next: Card[] = []
  let changed = false

  for (const card of shown) {
    const goal = wanted.get(card.id)
    const value = goal?.value ?? 0

    if (card.value > value) {
      const gap = card.value - value
      next.push({ ...card, value: card.value - (gap > BIG_DROP ? 2 : 1) })
      changed = true
    } else if (!goal) {
      // Arrivée à zéro et absente de la cible : la carte a fini de s'éteindre.
      changed = true
    } else {
      // Comparaison sur la valeur, jamais sur l'identité de l'objet : l'état en
      // reconstruit de neuves à chaque message, et s'y fier ferait tourner la boucle
      // d'animation sans fin.
      if (goal.value !== card.value) changed = true
      next.push(goal)
    }
  }

  for (const card of target) {
    if (shown.some((seen) => seen.id === card.id)) continue
    next.push(card)
    changed = true
  }

  return changed ? next : shown
}

/** Les deux listes parlent-elles des mêmes cartes ? Sinon, c'est une nouvelle donne. */
export function overlaps(shown: Card[], target: Card[]): boolean {
  return shown.length === 0 || shown.some((card) => target.some((other) => other.id === card.id))
}
