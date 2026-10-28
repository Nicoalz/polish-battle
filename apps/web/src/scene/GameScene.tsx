import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { AdaptiveDpr, ContactShadows, PerformanceMonitor } from '@react-three/drei'
import { useState } from 'react'
import type { GameState } from '@pb/engine'
import { isDealt, isStanding } from '@pb/engine'
import { PlayerSeat } from './PlayerSeat'
import { Card3D } from './Card3D'
import { Particles } from './Particles'
import { Projectile } from './Projectile'
import { Combination } from './Combination'
import { Dealing } from './Dealing'
import { CameraRig } from './CameraRig'
import { CARD_THICKNESS } from './textures'
import { DECK_POSITION, layout, seatColor, setLayout } from './seats'
import { projectPlates } from './nameplates'
import { DrawnCardEntry } from './DrawnCardEntry'

import { useStage } from './stage'

const DECK_CARD = { id: 'deck', rank: 0, value: 0 }

/** Pile de pioche au centre : quelques cartes empilées, face cachée. */
function Deck() {
  return (
    <group position={DECK_POSITION} rotation={[-Math.PI / 2, 0, 0]}>
      {Array.from({ length: 8 }, (_, index) => (
        <Card3D
          key={index}
          card={DECK_CARD}
          role="deck"
          faceDown
          position={[0, 0, index * CARD_THICKNESS]}
          scale={1.1}
        />
      ))}
    </group>
  )
}

/**
 * La carte dévoilée, suspendue au-dessus du paquet.
 *
 * Elle n'appartient à personne : un coup se joue à l'aveugle, et la carte n'apparaît
 * qu'au moment de se résoudre, le temps d'être vue par toute la table. Elle vient donc
 * de la mise en scène, pas de l'état de jeu.
 */
function RevealedCard() {
  const reveal = useStage((state) => state.reveal)
  const combining = useStage((state) => Boolean(state.combination))
  // Pendant l'addition, c'est elle qui tient la carte d'attaque.
  if (!reveal || combining) return null

  return (
    <DrawnCardEntry key={reveal.card.id} from={reveal.from}>
      <Card3D card={reveal.card} role="drawn" scale={1.5} />
    </DrawnCardEntry>
  )
}

/** Colle les plaques de nom à leur siège, une fois par image. */
function Nameplates({ game, mySeat }: { game: GameState; mySeat: number }) {
  const camera = useThree((state) => state.camera)
  const size = useThree((state) => state.size)

  useFrame(() => {
    projectPlates(camera, size, game.players, mySeat)
  })

  return null
}

function Table() {
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[7.4, 64]} />
        <meshStandardMaterial color="#2a1016" roughness={0.35} metalness={0.25} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.001, 0]}>
        <ringGeometry args={[5.5, 5.9, 64]} />
        <meshBasicMaterial color="#ff6b4a" transparent opacity={0.18} toneMapped={false} />
      </mesh>
    </group>
  )
}

function Lights({ accent }: { accent: string }) {
  return (
    <>
      <ambientLight intensity={0.55} />
      <directionalLight
        position={[2, 9, 6]}
        intensity={1.5}
        castShadow
        shadow-mapSize={[1024, 1024]}
      />
      <pointLight position={[-7, 4, -3]} intensity={60} color="#ff4d6d" distance={22} />
      <pointLight position={[7, 4, -3]} intensity={60} color="#ffa94d" distance={22} />
      {/* Lumière d'appoint teintée par le joueur dont c'est le tour : volontairement
          faible, sinon elle colore les cartes et nuit à la lecture des valeurs. */}
      <pointLight position={[0, 7, 3]} intensity={18} color={accent} distance={16} />
    </>
  )
}

type Props = {
  game: GameState
  mySeat: number
  compact: boolean
  selectableIds: Set<string>
  onSelectTarget: (playerId: string) => void
}

export function GameScene({ game, mySeat, compact, selectableIds, onSelectTarget }: Props) {
  // Sur téléphone on allège d'emblée : ombres portées et post-traitement y coûtent plus
  // cher qu'ils ne rapportent. `weak` retient en plus les appareils que le moniteur de
  // performance a vus faiblir, pour qu'un retour en grand écran ne les écrase pas.
  const [weak, setWeak] = useState(false)
  const degraded = compact || weak
  setLayout(compact ? 'tall' : 'wide')
  const accent = seatColor(game.turnSeat)
  const total = Math.max(1, game.players.length)

  return (
    <Canvas
      shadows={!degraded}
      dpr={[1, degraded ? 1 : 2]}
      gl={{ alpha: true, antialias: !degraded, powerPreference: 'high-performance' }}
      // react-three-fiber ne relit pas ces valeurs ensuite : c'est `CameraRig` qui tient
      // position et champ de vision à chaque image, et qui suit donc les changements de
      // format quand un téléphone bascule en portrait.
      camera={{ position: [...layout().camera], fov: layout().fov }}
    >
      <PerformanceMonitor onDecline={() => setWeak(true)} />
      <AdaptiveDpr pixelated />

      <CameraRig mySeat={mySeat} total={total} />
      <Nameplates game={game} mySeat={mySeat} />
      <Lights accent={accent} />
      <Table />
      <Deck />
      <RevealedCard />
      <Combination mySeat={mySeat} total={total} />
      <Dealing mySeat={mySeat} total={total} />
      <Projectile />
      {!degraded && <Particles color={accent} />}

      {game.players.map((player) => (
        <PlayerSeat
          key={player.id}
          player={player}
          mySeat={mySeat}
          total={total}
          isMe={player.seat === mySeat}
          isTurn={player.seat === game.turnSeat && game.phase === 'playing'}
          // Un siège ne montre de cartes que s'il en a reçu : au salon personne n'est
          // servi, et un arrivant d'entre deux manches attend la manche suivante.
          dealt={isDealt(player)}
          alive={isStanding(player)}
          selectable={selectableIds.has(player.id)}
          onSelect={onSelectTarget}
        />
      ))}

      {!degraded && (
        <ContactShadows
          position={[0, 0.012, 0]}
          opacity={0.22}
          scale={11}
          blur={3}
          far={1.2}
          resolution={512}
        />
      )}
    </Canvas>
  )
}
