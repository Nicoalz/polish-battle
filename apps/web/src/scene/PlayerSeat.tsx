import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { PlayerState } from '@pb/engine'
import { impactDecay, useStage } from './stage'
import { useSettings } from '../settings'
import { Card3D } from './Card3D'
import { seatAngle, seatColor, seatPosition, seatScale } from './seats'
import { CARD_HEIGHT, CARD_WIDTH } from './textures'

/** Les cartes sont inclinées vers la caméra : lisibles de partout, mais posées sur la table. */
const TILT = -Math.PI / 3.1
const CARD_TILT: [number, number, number] = [TILT, 0, 0]

const SPACING = CARD_WIDTH + 0.1
const ROW_Y = 0.4

/**
 * Décalage « vers le haut de la carte », dans son propre plan.
 *
 * Les cartes étant inclinées, monter d'une carte ne se fait pas le long de l'axe Y du
 * monde : il faut suivre l'axe Y local, qui plonge aussi vers le fond de la table.
 */
function alongCard(distance: number): [number, number] {
  return [Math.cos(TILT) * distance, Math.sin(TILT) * distance]
}

type Props = {
  player: PlayerState
  mySeat: number
  total: number
  isMe: boolean
  isTurn: boolean
  alive: boolean
  selectable: boolean
  onSelect: (playerId: string) => void
}

export function PlayerSeat({
  player,
  mySeat,
  total,
  isMe,
  isTurn,
  alive,
  selectable,
  onSelect,
}: Props) {
  const position = seatPosition(player.seat, mySeat, total)
  const color = seatColor(player.seat)
  const scale = seatScale(isMe)

  // Direction « vers l'extérieur de la table » pour ce siège. La plaque de nom se pose
  // de ce côté-là et la carte piochée de l'autre : les décalages suivent donc
  // l'orientation du siège au lieu d'être fixes, sinon le joueur local — assis en bas —
  // verrait son nom au milieu du tapis et sa pioche couvrir ses propres cartes.
  const angle = seatAngle(player.seat, mySeat, total)
  const outward: [number, number] = [Math.sin(angle), Math.cos(angle)]

  // Disposition : les cartes de vie côte à côte, le bouclier posé en travers au-dessus,
  // et la charge éventuelle face cachée sur le côté.
  const lifeWidth = Math.max(0, player.life.length - 1) * SPACING
  const [shieldY, shieldZ] = alongCard(CARD_HEIGHT / 2 + CARD_WIDTH / 2 + 0.09)
  const batteryX = lifeWidth / 2 + SPACING

  const halo = Math.max(1.05, (player.battery ? batteryX + CARD_WIDTH / 2 : lifeWidth / 2) + 0.45)
  const dimmed = !alive

  const cards = useRef<THREE.Group>(null)
  const glow = useRef<THREE.MeshBasicMaterial>(null)
  // Chaque siège respire à son propre rythme : en phase, la table aurait l'air mécanique.
  const phase = useMemo(() => Math.random() * Math.PI * 2, [])

  useFrame((state) => {
    const { impactAt, impactPower, impactSeat } = useStage.getState()
    const { reducedMotion } = useSettings.getState()
    const time = state.clock.elapsedTime

    if (cards.current) {
      const breath = reducedMotion ? 0 : Math.sin(time * 0.9 + phase)
      cards.current.position.y = breath * 0.022
      cards.current.rotation.z = breath * 0.005
    }

    if (glow.current) {
      const hit = impactSeat === player.seat ? impactDecay(impactAt, impactPower, 520) : 0
      const pulse = isTurn && !reducedMotion ? 0.07 + 0.05 * (0.5 + 0.5 * Math.sin(time * 2.4)) : isTurn ? 0.09 : 0.03
      glow.current.opacity = Math.min(0.75, pulse + hit * 0.7)
      glow.current.color.set(hit > 0 ? '#ff3b57' : color)
    }
  })

  return (
    <group position={position} scale={scale}>
      {/* Halo au sol : un cerne plutôt qu'un disque plein, qui formerait une flaque
          de couleur sous les cartes une fois vu en perspective. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.002, 0.1]}>
        <circleGeometry args={[halo, 48]} />
        <meshBasicMaterial ref={glow} transparent toneMapped={false} />
      </mesh>
      {isTurn && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.003, 0.1]}>
          <ringGeometry args={[halo - 0.05, halo, 56]} />
          <meshBasicMaterial color={color} transparent opacity={0.55} toneMapped={false} />
        </mesh>
      )}

      {/* Cible désignable : un anneau franc plutôt qu'un voile, qui masquerait les cartes. */}
      {selectable && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.004, 0.1]}>
          <ringGeometry args={[halo - 0.08, halo, 56]} />
          <meshBasicMaterial color="#5eead4" transparent opacity={0.9} toneMapped={false} />
        </mesh>
      )}

      {/* Zone de clic, invisible mais bien présente pour le lancer de rayon. */}
      {selectable && (
        <mesh
          rotation={[-Math.PI / 2, 0, 0]}
          position={[0, 0.03, 0.1]}
          onPointerDown={(event) => {
            event.stopPropagation()
            onSelect(player.id)
          }}
          onPointerOver={() => (document.body.style.cursor = 'pointer')}
          onPointerOut={() => (document.body.style.cursor = 'auto')}
        >
          <circleGeometry args={[halo, 48]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
      )}

      <group ref={cards}>
      {/* Bouclier : en travers, au-dessus de la vie. */}
      <Card3D
        card={player.shield}
        role="shield"
        orientation="landscape"
        position={[0, ROW_Y + shieldY, shieldZ]}
        rotation={CARD_TILT}
        dimmed={dimmed}
      />

      {/* Cartes de vie, côte à côte. */}
      {player.life.map((card, index) => (
        <Card3D
          key={card.id}
          card={card}
          role="life"
          position={[index * SPACING - lifeWidth / 2, ROW_Y, 0]}
          rotation={CARD_TILT}
          dimmed={dimmed}
        />
      ))}

      {/* La charge se montre face cachée : on sait qu'elle est là, pas ce qu'elle vaut. */}
      {player.battery && (
        <Card3D
          card={player.battery}
          role="battery"
          faceDown
          position={[batteryX, ROW_Y, 0]}
          rotation={CARD_TILT}
          dimmed={dimmed}
        />
      )}
      </group>

    </group>
  )
}
