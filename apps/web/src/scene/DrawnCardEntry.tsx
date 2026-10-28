import { useRef, type ReactNode } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { easeOut, useStage } from './stage'
import { useSettings } from '../settings'
import { DRAWN_CARD_POSITION, TILT } from './seats'

const DURATION = 620

/**
 * Entrée de la carte dévoilée.
 *
 * Elle se lève de la place de son auteur, monte en tournant et se retourne face
 * visible au centre de la table. L'origine dit qui joue — c'était la seule information
 * qui manquait, la carte apparaissant jusqu'ici au même endroit pour tout le monde.
 *
 * La destination, elle, reste le centre : on apprend la valeur avant de savoir sur qui
 * elle tombe, et c'est le dernier suspense du tour. Remonté à chaque nouvelle carte
 * grâce à sa clé.
 */
export function DrawnCardEntry({
  from,
  children,
}: {
  from: [number, number, number]
  children: ReactNode
}) {
  const group = useRef<THREE.Group>(null)
  const startedAt = useRef(performance.now())

  useFrame(() => {
    if (!group.current) return
    const { reducedMotion } = useSettings.getState()
    const raw = reducedMotion
      ? 1
      : Math.min(1, (performance.now() - startedAt.current) / DURATION)
    const t = easeOut(raw)

    const [dx, dy, dz] = from
    const [tx, ty, tz] = DRAWN_CARD_POSITION
    group.current.position.set(
      dx + (tx - dx) * t,
      dy + (ty - dy) * t + Math.sin(Math.PI * t) * 0.6,
      dz + (tz - dz) * t,
    )
    // Elle part couchée sur la table, dos visible, à l'inclinaison des cartes posées,
    // et finit dressée face au joueur : le quart de tour va de π vers 0, et non
    // l'inverse.
    group.current.rotation.set(TILT + (-Math.PI / 7 - TILT) * t, Math.PI * (1 - t), 0)
    group.current.scale.setScalar(0.8 + 0.2 * t)
  })

  return <group ref={group}>{children}</group>
}
