import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Card3D } from './Card3D'
import { dealCount, dealProgress, dealSlot, easeOut, useStage } from './stage'
import { DECK_POSITION, TILT, slotWorld } from './seats'

/**
 * La distribution de début de partie.
 *
 * Les cartes quittent le paquet une à une et vont se poser à leur place. Elles voyagent
 * dos tourné : à l'instant où elles atterrissent, c'est la vraie carte du siège qui
 * apparaît — la mise en scène ne connaît donc aucune valeur, et ne peut rien éventer.
 *
 * Un petit nombre de cartes vole à la fois : on les recycle au lieu d'en monter vingt-
 * quatre pour les jeter deux secondes plus tard, chacune avec ses matériaux à elle.
 */

/** Hauteur de la cloche. Assez pour passer au-dessus des cartes déjà posées. */
const ARC = 0.9

/** Carte anonyme : toutes les cartes en vol montrent le même dos. */
const FACE_DOWN = { id: 'deal', rank: 0, value: 0 }

export function Dealing({ mySeat, total }: { mySeat: number; total: number }) {
  const deal = useStage((state) => state.deal)
  const slots = useRef<(THREE.Group | null)[]>([])

  // Taille du vol : le nombre de cartes en l'air en même temps, plus une de marge.
  const size = deal ? Math.min(8, Math.ceil(deal.flight / deal.perCard) + 1) : 0

  useFrame(() => {
    const current = useStage.getState().deal
    if (!current) return

    const now = performance.now()
    let used = 0

    for (let rank = 0; rank < dealCount(current); rank++) {
      const progress = dealProgress(current, rank, now)
      if (progress < 0 || progress >= 1) continue

      const node = slots.current[used++]
      if (!node) break

      const { seat, round } = dealSlot(current, rank)
      const target = slotWorld(
        seat,
        mySeat,
        total,
        round < current.lifeCount ? { kind: 'life', index: round } : { kind: 'shield' },
        current.lifeCount,
      )

      const t = easeOut(progress)
      node.visible = true
      node.position.set(
        DECK_POSITION[0] + (target[0] - DECK_POSITION[0]) * t,
        DECK_POSITION[1] + (target[1] - DECK_POSITION[1]) * t + Math.sin(Math.PI * progress) * ARC,
        DECK_POSITION[2] + (target[2] - DECK_POSITION[2]) * t,
      )
      // La carte quitte le paquet à plat et finit inclinée comme sa voisine de rangée.
      node.rotation.set(-Math.PI / 2 + (TILT + Math.PI / 2) * t, 0, (1 - t) * (rank % 2 ? 0.5 : -0.5))
    }

    for (let index = used; index < slots.current.length; index++) {
      const node = slots.current[index]
      if (node) node.visible = false
    }
  })

  if (!deal) return null

  return (
    <>
      {Array.from({ length: size }, (_, index) => (
        <group
          key={index}
          visible={false}
          ref={(node) => {
            slots.current[index] = node
          }}
        >
          <Card3D card={FACE_DOWN} role="deck" faceDown />
        </group>
      ))}
    </>
  )
}
