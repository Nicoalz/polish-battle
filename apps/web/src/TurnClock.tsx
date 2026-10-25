import { useEffect, useState } from 'react'
import { TURN_LIMIT_MS } from '@pb/engine'
import { useI18n } from './i18n'

/** En dessous, on prévient : au-dessus, un compte à rebours ne ferait que stresser. */
const WARN_MS = 25_000

/**
 * Compte à rebours du tour en cours.
 *
 * Le serveur passe la main au bout d'un délai ; sans rien à l'écran, le joueur verrait
 * son tour disparaître sans comprendre. Le décompte part du changement de tour
 * **autoritaire** — et non de l'état affiché, en retard d'une animation — pour coller
 * d'aussi près que possible à l'horloge du serveur.
 *
 * Composant à part : il se redessine deux fois par seconde, et n'entraîne pas la scène
 * avec lui.
 */
export function TurnClock({ turnSeat, playing }: { turnSeat: number; playing: boolean }) {
  const t = useI18n((state) => state.t)
  const [left, setLeft] = useState(TURN_LIMIT_MS)

  useEffect(() => {
    if (!playing) return
    const startedAt = Date.now()
    const tick = () => setLeft(Math.max(0, TURN_LIMIT_MS - (Date.now() - startedAt)))
    tick()
    const timer = window.setInterval(tick, 500)
    return () => window.clearInterval(timer)
  }, [turnSeat, playing])

  if (!playing || left > WARN_MS) return null

  return (
    <span className={left < 10_000 ? 'text-rose-300' : 'text-amber-300'}>
      {' · '}
      {t.table.secondsLeft(Math.ceil(left / 1000))}
    </span>
  )
}
