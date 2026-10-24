import type { Card, GameState } from './types'
import { nextInt } from './rng'

/**
 * Les cartes de Polish Battle.
 *
 * Le jeu est né sur table, avec un jeu de 52 cartes classique. En version écran, la
 * famille (♠♥♦♣) ne servait plus à rien : sur 52 cartes, une seule la rendait
 * signifiante — le roi de cœur, qui valait 0. Elle a donc disparu au profit d'un
 * dessin propre au jeu, où la couleur d'une carte dit son rôle (vie, bouclier, charge).
 *
 * La **distribution des valeurs reste identique au tirage d'origine**, pour ne pas
 * changer l'équilibre en changeant l'habillage :
 *
 *   valeur 0       1 chance sur 52   (l'ancien roi de cœur, devenu « la carte maudite »)
 *   valeur 13      3 chances sur 52  (les trois autres rois)
 *   valeurs 1 à 12 4 chances sur 52  chacune
 */

export const MIN_VALUE = 1
export const MAX_VALUE = 13
/** Nombre de tirages équiprobables, hérité du paquet de 52 cartes. */
const OUTCOMES = 52

export function isCursed(card: Pick<Card, 'rank'>): boolean {
  return card.rank === 0
}

/** Une carte de vie entamée affiche moins que sa valeur d'origine. */
export function isDamaged(card: Card): boolean {
  return card.value < card.rank
}

export function cardLabel(card: Card): string {
  return isCursed(card) ? 'carte maudite' : String(card.value)
}

/**
 * Tire une carte et fait avancer l'état (graine + compteur d'identifiants).
 *
 * Il n'y a volontairement pas de paquet : chaque tirage est indépendant, comme en v1.
 * Les doublons sont donc possibles et la carte maudite peut sortir plusieurs fois.
 */
export function drawCard(state: GameState): Card {
  const [seed, roll] = nextInt(state.rng, OUTCOMES)
  state.rng = seed

  // Un tirage sur 52 donne la carte maudite ; les 51 autres se répartissent en groupes
  // de quatre, ce qui laisse trois chances sur 52 à la valeur maximale.
  const rank = roll === 0 ? 0 : Math.min(MAX_VALUE, MIN_VALUE + Math.floor((roll - 1) / 4))

  return { id: `c${state.cardSeq++}`, rank, value: rank }
}

export function drawCards(state: GameState, count: number): Card[] {
  const cards: Card[] = []
  for (let i = 0; i < count; i++) cards.push(drawCard(state))
  return cards
}

export function totalValue(cards: Card[]): number {
  return cards.reduce((sum, card) => sum + card.value, 0)
}

/**
 * Tire des cartes de vie en garantissant un total non nul.
 *
 * Sans cette garde, un joueur servi en cartes maudites naîtrait mort — c'est le bug n°3
 * de GAME_RULES.md. Le cas est rarissime (1/52 pour une carte, 1/2704 pour deux), mais
 * il rendait la partie incohérente dès la distribution.
 */
export function drawLifeCards(state: GameState, count: number): Card[] {
  let cards = drawCards(state, count)
  let guard = 0
  while (totalValue(cards) === 0 && guard++ < 50) {
    cards = drawCards(state, count)
  }
  if (totalValue(cards) === 0) {
    // Inatteignable en pratique ; on garantit malgré tout l'invariant « vie > 0 ».
    cards[0] = { ...cards[0]!, rank: MAX_VALUE, value: MAX_VALUE }
  }
  return cards
}
