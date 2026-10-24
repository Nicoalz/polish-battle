import { create } from 'zustand'
import type { Card } from '@pb/engine'

/**
 * État visuel transitoire de la scène : tout ce qui n'appartient pas à la partie mais
 * à sa mise en scène. Séparé de l'état de jeu pour que les animations puissent battre
 * à leur rythme sans provoquer de rendu de l'interface.
 */

export type Flight = {
  cards: Card[]
  from: [number, number, number]
  to: [number, number, number]
  /** Une attaque file droit et frappe ; une pose se dépose. */
  kind: 'attack' | 'place'
  startedAt: number
  duration: number
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
  flight?: Flight
  /** Date du dernier impact : éclair et secousse en découlent par décroissance. */
  impactAt: number
  impactPower: number
  /** Siège encaissant le coup, pour que sa place réagisse elle aussi. */
  impactSeat?: number
  /** Siège sur lequel la caméra se penche pendant une cinématique. */
  focusSeat?: number

  setReveal: (card: Card | undefined) => void
  setFlight: (flight: Flight | undefined) => void
  impact: (power: number, seat?: number) => void
  focus: (seat: number | undefined) => void
}

export const useStage = create<Stage>((set) => ({
  impactAt: -Infinity,
  impactPower: 0,

  setReveal: (card) => set({ reveal: card }),
  setFlight: (flight) => set({ flight }),
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
