import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { PlayerState } from '@pb/engine'
import { dealProgress, dealRank, impactDecay, useStage } from './stage'
import { useCountdown } from './useCountdown'
import { useSettings } from '../settings'
import { Card3D } from './Card3D'
import {
  CARD_TILT,
  handRadius,
  seatAngle,
  seatColor,
  seatPosition,
  seatScale,
  slotLocal,
} from './seats'

type Props = {
  player: PlayerState
  mySeat: number
  total: number
  isMe: boolean
  isTurn: boolean
  /** Faux au salon : les places sont là, les mains pas encore. */
  dealt: boolean
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
  dealt,
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

  // Les cartes de vie rendues descendent une valeur à la fois : la place d'une carte
  // détruite reste donc occupée le temps qu'elle s'éteigne.
  const life = useCountdown(player.life)

  // Disposition : les cartes de vie côte à côte, le bouclier posé en travers au-dessus,
  // et la charge éventuelle face cachée sur le côté. Les mesures viennent de `seats`,
  // que la distribution consulte elle aussi pour viser les mêmes emplacements.
  const halo = handRadius(life.length, Boolean(player.battery))
  const dimmed = !alive

  // Vrai quand cette charge est justement en train d'être dépensée dans une attaque.
  const spending = useStage(
    (state) => state.combination !== undefined && state.combination.fromSeat === player.seat,
  )

  const cards = useRef<THREE.Group>(null)
  const glow = useRef<THREE.MeshBasicMaterial>(null)
  /**
   * Emplacements servis par la distribution : les cartes de vie, puis le bouclier.
   *
   * Pendant la donne, chacun reste invisible jusqu'à ce que la carte qui l'apporte ait
   * atterri — c'est ce qui fait qu'on la voit arriver au lieu d'apparaître. Le bouclier
   * a sa propre référence plutôt qu'une case en fin de tableau : son rang dépend du
   * nombre de cartes de vie, et ce nombre change précisément quand la donne commence.
   */
  const lifeSlots = useRef<(THREE.Group | null)[]>([])
  const shieldSlot = useRef<THREE.Group>(null)
  // Chaque siège respire à son propre rythme : en phase, la table aurait l'air mécanique.
  const phase = useMemo(() => Math.random() * Math.PI * 2, [])

  /**
   * Affaissement du siège, de 0 debout à 1 à terre.
   *
   * Un joueur éliminé se contentait de griser. Ses cartes s'affaissent maintenant et
   * partent de travers — on voit la place tomber au lieu de la trouver éteinte. Le
   * moment se repère sur ce que le siège affiche, et non sur le récit : il n'a pas à
   * connaître l'événement pour réagir à son propre état.
   *
   * Amorti vers sa cible plutôt que joué depuis un instant, parce que la chute a une
   * réciproque : on relève les morts, dans ce jeu, et un retour sec ferait remonter la
   * main d'un seul coup juste après la lumière censée rendre le moment solennel. Un
   * siège déjà vide au montage part à terre sans rejouer sa chute.
   */
  const fall = useRef(alive ? 0 : 1)

  useFrame((state, delta) => {
    const { impactAt, impactPower, impactSeat, deal } = useStage.getState()
    const { reducedMotion } = useSettings.getState()
    const time = state.clock.elapsedTime

    const now = performance.now()
    const served = (round: number) =>
      !deal || dealProgress(deal, dealRank(deal, player.seat, round), now) >= 1

    lifeSlots.current.forEach((node, index) => {
      if (node) node.visible = served(index)
    })
    // Le bouclier est servi en dernier, au tour qui suit la dernière carte de vie.
    if (shieldSlot.current) shieldSlot.current.visible = served(life.length)

    // Amorti exponentiel : la chute dure le même temps quel que soit le nombre
    // d'images par seconde. Animations réduites : on prend l'état, pas le mouvement.
    const target = alive ? 0 : 1
    fall.current = reducedMotion
      ? target
      : fall.current + (target - fall.current) * (1 - Math.exp(-delta * 5))

    if (cards.current) {
      const breath = reducedMotion ? 0 : Math.sin(time * 0.9 + phase)
      cards.current.position.y = breath * 0.022 - fall.current * 0.34
      cards.current.rotation.z = breath * 0.005 + fall.current * 0.22
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

      {dealt && (
      <group ref={cards}>
      {/* Bouclier : en travers, au-dessus de la vie. */}
      <group ref={shieldSlot}>
        <Card3D
          card={player.shield}
          role="shield"
          orientation="landscape"
          position={slotLocal({ kind: 'shield' }, life.length)}
          rotation={CARD_TILT}
          dimmed={dimmed}
        />
      </group>

      {/* Cartes de vie, côte à côte. */}
      {life.map((card, index) => (
        <group
          key={card.id}
          ref={(node) => {
            lifeSlots.current[index] = node
          }}
        >
          <Card3D
            card={card}
            role="life"
            position={slotLocal({ kind: 'life', index }, life.length)}
            rotation={CARD_TILT}
            dimmed={dimmed}
          />
        </group>
      ))}

      {/* La charge se montre face cachée : on sait qu'elle est là, pas ce qu'elle vaut.
          Pendant qu'elle s'envole pour s'additionner, c'est l'animation qui la tient :
          la laisser ici la montrerait en double. */}
      {player.battery && !spending && (
        <Card3D
          card={player.battery}
          role="battery"
          faceDown
          position={slotLocal({ kind: 'battery' }, life.length)}
          rotation={CARD_TILT}
          dimmed={dimmed}
        />
      )}
      </group>
      )}

    </group>
  )
}
