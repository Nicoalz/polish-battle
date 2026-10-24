import { useEffect, useReducer, useRef } from 'react'
import type { Card } from '@pb/engine'
import { useSettings } from '../settings'
import { TICK_MS, overlaps, stepTowards } from './countdown'

/** Cartes de vie à afficher : elles rattrapent la vérité du jeu un point à la fois. */
export function useCountdown(life: Card[]): Card[] {
  const reducedMotion = useSettings((state) => state.reducedMotion)
  const shown = useRef<Card[]>(life)
  const [, redraw] = useReducer((count: number) => count + 1, 0)

  useEffect(() => {
    // Nouvelle donne, ou animations coupées : on affiche la vérité sans détour.
    if (reducedMotion || !overlaps(shown.current, life)) {
      if (shown.current !== life) {
        shown.current = life
        redraw()
      }
      return
    }

    if (stepTowards(shown.current, life) === shown.current) return

    const advance = () => {
      const next = stepTowards(shown.current, life)
      if (next === shown.current) {
        window.clearInterval(timer)
        return
      }
      shown.current = next
      redraw()
    }

    const timer = window.setInterval(advance, TICK_MS)
    advance()
    return () => window.clearInterval(timer)
  }, [life, reducedMotion])

  return shown.current
}
