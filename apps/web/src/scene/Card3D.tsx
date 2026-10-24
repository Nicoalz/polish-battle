import { useMemo } from 'react'
import * as THREE from 'three'
import type { Card } from '@pb/engine'
import {
  CARD_HEIGHT,
  CARD_THICKNESS,
  CARD_WIDTH,
  backTexture,
  faceTexture,
  roleColor,
  type CardRole,
  type Orientation,
} from './textures'

export type { CardRole } from './textures'

/** Tranche de la carte : la même pour toutes, donc créée une seule fois. */
const edgeMaterial = new THREE.MeshStandardMaterial({
  color: '#2a2f3c',
  roughness: 0.7,
  metalness: 0,
})

const GEOMETRY: Record<Orientation, THREE.BoxGeometry> = {
  portrait: new THREE.BoxGeometry(CARD_WIDTH, CARD_HEIGHT, CARD_THICKNESS),
  landscape: new THREE.BoxGeometry(CARD_HEIGHT, CARD_WIDTH, CARD_THICKNESS),
}

type Props = {
  card: Card
  role: CardRole
  position?: [number, number, number]
  rotation?: [number, number, number]
  scale?: number
  faceDown?: boolean
  dimmed?: boolean
  orientation?: Orientation
  /** Rôle du dos, quand il diffère de la face : une carte piochée qui devient charge. */
  backRole?: CardRole
}

export function Card3D({
  card,
  role,
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  scale = 1,
  faceDown = false,
  dimmed = false,
  orientation = 'portrait',
  backRole,
}: Props) {
  const back = backRole ?? role
  const materials = useMemo(() => {
    const front = new THREE.MeshStandardMaterial({
      map: faceDown ? backTexture(role, orientation) : faceTexture(card, role, orientation),
      roughness: 0.5,
      metalness: 0.03,
    })
    const backMaterial = new THREE.MeshStandardMaterial({
      map: backTexture(back, orientation),
      roughness: 0.5,
      metalness: 0.03,
    })
    // Ordre des faces d'une BoxGeometry : +x, -x, +y, -y, +z, -z.
    return [edgeMaterial, edgeMaterial, edgeMaterial, edgeMaterial, front, backMaterial]
    // Les dépendances portent sur le contenu, pas sur l'objet : l'adaptateur recrée une
    // carte neuve à chaque correctif d'état, et se caler sur son identité ferait
    // reconstruire — sans jamais les libérer — deux matériaux par carte et par message.
  }, [card.value, card.rank, role, back, faceDown, orientation])

  const landscape = orientation === 'landscape'
  const haloWidth = (landscape ? CARD_HEIGHT : CARD_WIDTH) + 0.08
  const haloHeight = (landscape ? CARD_WIDTH : CARD_HEIGHT) + 0.08

  return (
    <group position={position} rotation={rotation} scale={scale}>
      {/* Halo discret : le fond de la carte dit déjà son rôle, le halo ne fait que la
          détacher du tapis sombre. */}
      <mesh position={[0, 0, -CARD_THICKNESS]}>
        <planeGeometry args={[haloWidth, haloHeight]} />
        <meshBasicMaterial
          color={roleColor(faceDown ? back : role)}
          transparent
          opacity={dimmed ? 0.1 : 0.32}
          toneMapped={false}
        />
      </mesh>
      <mesh geometry={GEOMETRY[orientation]} material={materials} castShadow />
    </group>
  )
}
