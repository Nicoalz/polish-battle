import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Card3D } from './Card3D'
import { easeOut, useStage } from './stage'
import { DRAWN_CARD_POSITION, seatAnchor } from './seats'

/**
 * Mise en scène de l'addition carte d'attaque + charge.
 *
 * Quatre temps, pour qu'on ait le temps de lire : la charge monte de son siège en se
 * retournant, les deux cartes s'écartent côte à côte, elles se rapprochent, puis se
 * fondent en une seule portant le total.
 *
 * L'échelle sert d'apparition et de disparition : les cartes sont opaques, et la faire
 * passer par zéro évite de toucher à leurs matériaux à chaque image.
 */
const ARRIVE = 0.3
const READ = 0.66
const MERGE = 0.9

/**
 * Demi-écartement des deux cartes pendant la lecture.
 *
 * Une carte mesure 0,72 de large, agrandie à 1,5 : il faut nettement plus que sa
 * demi-largeur de chaque côté, sans quoi elles se recouvrent au lieu de se lire.
 */
const SPREAD = 1.05

function phase(t: number, from: number, to: number): number {
  return Math.min(1, Math.max(0, (t - from) / (to - from)))
}

export function Combination({ mySeat, total }: { mySeat: number; total: number }) {
  const combination = useStage((state) => state.combination)
  const attack = useRef<THREE.Group>(null)
  const charge = useRef<THREE.Group>(null)
  const sum = useRef<THREE.Group>(null)

  useFrame(() => {
    if (!combination || !attack.current || !charge.current || !sum.current) return

    const raw = Math.min(1, (performance.now() - combination.startedAt) / combination.duration)
    const [cx, cy, cz] = DRAWN_CARD_POSITION

    // La charge quitte son siège et vient se placer à droite, face découverte.
    const arriving = easeOut(phase(raw, 0, ARRIVE))
    const [sx, , sz] = seatAnchor(combination.fromSeat, mySeat, total, 0)
    charge.current.position.set(
      sx + (cx + SPREAD - sx) * arriving,
      0.5 + (cy - 0.5) * arriving + Math.sin(Math.PI * arriving) * 0.5,
      sz + (cz - sz) * arriving,
    )
    charge.current.rotation.set(-Math.PI / 7, Math.PI * (1 - arriving), 0)

    // Puis les deux se rapprochent jusqu'à se confondre.
    const merging = easeOut(phase(raw, READ, MERGE))
    attack.current.position.set(cx - SPREAD * arriving * (1 - merging), cy, cz)
    charge.current.position.x = cx + SPREAD * arriving * (1 - merging)

    // Elles s'effacent au moment où le total prend leur place.
    const fade = 1 - phase(raw, MERGE - 0.06, MERGE + 0.04)
    attack.current.scale.setScalar(1.5 * fade)
    charge.current.scale.setScalar(1.5 * arriving * fade)

    const born = easeOut(phase(raw, MERGE - 0.02, 1))
    sum.current.position.set(cx, cy, cz)
    sum.current.rotation.set(-Math.PI / 7, 0, 0)
    // Léger dépassement d'échelle : l'addition se voit, elle ne se devine pas.
    sum.current.scale.setScalar(born * (1.7 - 0.2 * born))
  })

  if (!combination) return null

  return (
    <>
      <group ref={attack}>
        <Card3D card={combination.attack} role="drawn" />
      </group>
      <group ref={charge} scale={0}>
        <Card3D card={combination.charge} role="battery" />
      </group>
      <group ref={sum} scale={0}>
        <Card3D card={combination.total} role="drawn" />
      </group>
    </>
  )
}
