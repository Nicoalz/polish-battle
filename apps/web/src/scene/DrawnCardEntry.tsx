import { useRef, type ReactNode } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { easeOut, useStage } from './stage'
import { useSettings } from '../settings'
import { DECK_POSITION, DRAWN_CARD_POSITION } from './seats'

const DURATION = 620

/**
 * Entrée de la carte piochée.
 *
 * Elle se détache du paquet, monte en tournant et se retourne face visible. C'est le
 * moment de suspense du tour : on voit la carte avant de savoir ce que son propriétaire
 * va en faire. Remonté à chaque nouvelle carte grâce à sa clé.
 */
export function DrawnCardEntry({ children }: { children: ReactNode }) {
  const group = useRef<THREE.Group>(null)
  const startedAt = useRef(performance.now())

  useFrame(() => {
    if (!group.current) return
    const { reducedMotion } = useSettings.getState()
    const raw = reducedMotion
      ? 1
      : Math.min(1, (performance.now() - startedAt.current) / DURATION)
    const t = easeOut(raw)

    const [dx, dy, dz] = DECK_POSITION
    const [tx, ty, tz] = DRAWN_CARD_POSITION
    group.current.position.set(
      dx + (tx - dx) * t,
      dy + (ty - dy) * t + Math.sin(Math.PI * t) * 0.6,
      dz + (tz - dz) * t,
    )
    // Elle part à plat sur le paquet, dos visible, et finit dressée face au joueur :
    // le quart de tour va donc de π vers 0, et non l'inverse.
    group.current.rotation.set(
      -Math.PI / 2 + (Math.PI / 2 - Math.PI / 7) * t,
      Math.PI * (1 - t),
      0,
    )
    group.current.scale.setScalar(0.8 + 0.2 * t)
  })

  return <group ref={group}>{children}</group>
}
