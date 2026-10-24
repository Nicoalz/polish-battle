import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Card3D } from './Card3D'
import { easeOut, useStage } from './stage'
import { CARD_WIDTH } from './textures'
import { isHiddenCard } from '@pb/engine'

/**
 * La carte en vol.
 *
 * Une attaque part en cloche et accélère vers sa cible ; une pose glisse doucement. La
 * carte tourne sur elle-même en chemin, et une charge se retourne pour arriver face
 * cachée — le retournement raconte à lui seul qu'elle devient secrète.
 */
export function Projectile() {
  const flight = useStage((state) => state.flight)
  const group = useRef<THREE.Group>(null)

  useFrame(() => {
    if (!flight || !group.current) return

    const raw = Math.min(1, (performance.now() - flight.startedAt) / flight.duration)
    const attack = flight.kind === 'attack'
    // Une attaque prend de la vitesse, une pose en perd : la courbe dit l'intention.
    const t = attack ? raw * raw : easeOut(raw)

    const [fx, fy, fz] = flight.from
    const [tx, ty, tz] = flight.to
    const arc = attack ? 0.5 : 1.1

    group.current.position.set(
      fx + (tx - fx) * t,
      fy + (ty - fy) * t + Math.sin(Math.PI * t) * arc,
      fz + (tz - fz) * t,
    )
    group.current.rotation.set(
      -Math.PI / 7 + (attack ? -0.7 : 0.2) * t,
      0,
      attack ? t * 0.8 : 0,
    )
    const swell = attack ? 1 + 0.25 * Math.sin(Math.PI * t) : 1
    group.current.scale.setScalar(swell)
  })

  if (!flight) return null

  return (
    <group ref={group}>
      {flight.cards.map((card, index) => (
        <Card3D
          key={card.id}
          card={card}
          // La seconde carte d'une attaque est la charge dépensée : elle suit en retrait.
          role={index === 0 ? 'drawn' : 'battery'}
          // Une charge voyage dos tourné : sa valeur n'est connue de personne, pas même
          // de celui qui la pose. Une attaque, elle, révèle ce qu'elle emporte.
          faceDown={isHiddenCard(card)}
          position={[index * CARD_WIDTH * 0.45, index * -0.06, index * -0.05]}
          scale={index === 0 ? 1.4 : 1}
        />
      ))}
    </group>
  )
}
