import { create } from 'zustand'
import type { Card } from '@pb/engine'

/**
 * État visuel transitoire de la scène : tout ce qui n'appartient pas à la partie mais
 * à sa mise en scène. Séparé de l'état de jeu pour que les animations puissent battre
 * à leur rythme sans provoquer de rendu de l'interface.
 */

/**
 * Addition d'une carte d'attaque et d'une charge dépensée.
 *
 * C'est le seul moment où la valeur d'une charge se découvre : elle arrive de son siège,
 * se retourne, s'additionne à la carte d'attaque, et les deux se fondent en une seule
 * carte portant le total. Sans cette pause, le joueur voit partir un chiffre qu'il n'a
 * jamais lu.
 */
export type Combination = {
  attack: Card
  charge: Card
  /** Carte résultante, dont la valeur est la somme des deux. */
  total: Card
  /** Siège d'où la charge s'envole. */
  fromSeat: number
  startedAt: number
  duration: number
}

export type Flight = {
  cards: Card[]
  from: [number, number, number]
  to: [number, number, number]
  /** Une attaque file droit et frappe ; une pose se dépose. */
  kind: 'attack' | 'place'
  startedAt: number
  duration: number
}

/**
 * Distribution en cours.
 *
 * La donne n'est pas un événement de plus : c'est une horloge. Les sièges s'y réfèrent
 * pour savoir quelle carte est déjà posée, et les cartes en vol pour savoir où elles en
 * sont — les deux lisent la même, donc rien ne peut se dédoubler ni manquer.
 */
export type Deal = {
  startedAt: number
  /** Intervalle entre deux départs. */
  perCard: number
  /** Durée du vol d'une carte. */
  flight: number
  players: number
  /** Siège servi en premier : celui qui ouvre la partie. */
  firstSeat: number
  lifeCount: number
}

/**
 * Rideau baissé, avant même de savoir ce qu'il y a derrière.
 *
 * Le départ est dans le futur, donc aucune carte n'est posée : la table est masquée le
 * temps que la nouvelle donne arrive, sans attendre d'en connaître la forme.
 */
export const DEAL_PENDING: Deal = {
  startedAt: Number.POSITIVE_INFINITY,
  perCard: 1,
  flight: 1,
  players: 1,
  firstSeat: 0,
  lifeCount: 0,
}

/** Nombre de cartes servies en tout. */
export function dealCount(deal: Deal): number {
  return deal.players * (deal.lifeCount + 1)
}

/**
 * Rang d'une carte dans l'ordre de distribution.
 *
 * On sert tour par tour et non joueur par joueur : une carte à chacun, puis la
 * deuxième, puis le bouclier. C'est ainsi qu'on distribue à une vraie table, et cela
 * évite qu'un joueur voie sa main complète pendant que son voisin attend.
 */
export function dealRank(deal: Deal, seat: number, round: number): number {
  const offset = (((seat - deal.firstSeat) % deal.players) + deal.players) % deal.players
  return round * deal.players + offset
}

/** Siège et tour que sert la carte de rang donné. */
export function dealSlot(deal: Deal, rank: number): { seat: number; round: number } {
  return {
    seat: (deal.firstSeat + (rank % deal.players)) % deal.players,
    round: Math.floor(rank / deal.players),
  }
}

/** Avancement d'une carte : négatif avant son départ, 1 une fois posée. */
export function dealProgress(deal: Deal, rank: number, now: number): number {
  return (now - deal.startedAt - rank * deal.perCard) / deal.flight
}

type Stage = {
  /**
   * Carte dévoilée au centre de la table.
   *
   * Un coup se joue à l'aveugle : la carte n'existe qu'au moment de se résoudre, le
   * temps d'être vue. Elle n'appartient donc à aucun joueur et ne vit que dans la mise
   * en scène.
   */
  reveal?: Card
  combination?: Combination
  flight?: Flight
  /** Distribution en cours : tant qu'elle dure, les sièges ne montrent que ce qui a atterri. */
  deal?: Deal
  /** Date du dernier impact : éclair et secousse en découlent par décroissance. */
  impactAt: number
  impactPower: number
  /** Siège encaissant le coup, pour que sa place réagisse elle aussi. */
  impactSeat?: number
  /** Siège sur lequel la caméra se penche pendant une cinématique. */
  focusSeat?: number

  setReveal: (card: Card | undefined) => void
  setCombination: (combination: Combination | undefined) => void
  setFlight: (flight: Flight | undefined) => void
  setDeal: (deal: Deal | undefined) => void
  impact: (power: number, seat?: number) => void
  focus: (seat: number | undefined) => void
}

export const useStage = create<Stage>((set) => ({
  impactAt: -Infinity,
  impactPower: 0,

  setReveal: (card) => set({ reveal: card }),
  setCombination: (combination) => set({ combination }),
  setFlight: (flight) => set({ flight }),
  setDeal: (deal) => set({ deal }),
  impact: (power, seat) =>
    set({ impactAt: performance.now(), impactPower: power, impactSeat: seat }),
  focus: (seat) => set({ focusSeat: seat }),
}))

/** Décroissance d'un impact, de 1 juste après le choc à 0 au bout de `ms`. */
export function impactDecay(impactAt: number, power: number, ms: number): number {
  const elapsed = performance.now() - impactAt
  if (elapsed < 0 || elapsed > ms) return 0
  return power * (1 - elapsed / ms)
}

/** Courbe d'amorti : départ franc, arrivée douce. */
export function easeOut(t: number): number {
  return 1 - (1 - t) ** 3
}
