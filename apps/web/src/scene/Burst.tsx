import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useStage, type Burst as Gerbe } from './stage'
import { useSettings } from '../settings'
import { SEAT_COLORS } from './seats'

/**
 * Les gerbes de fragments.
 *
 * Une carte de vie qui éclate, un joueur qui tombe, quelqu'un qu'on relève, une partie
 * gagnée : quatre moments qui n'avaient qu'un son. Un seul maillage instancié les sert
 * tous — ils ne se chevauchent jamais — et chacun ne se distingue que par la trajectoire
 * de ses fragments.
 */

const MAX = 140

/** Durée de vie d'une gerbe, par nature. */
const LIFE = { shatter: 950, rise: 1150, confetti: 3400 } as const

/** Objets de travail réutilisés : allouer dans la boucle de rendu provoque des saccades. */
const dummy = new THREE.Object3D()
const tint = new THREE.Color()

type Seed = {
  dir: THREE.Vector3
  speed: number
  spin: number
  size: number
  /** Décalage propre au fragment : c'est lui qui empêche la gerbe d'être un bloc. */
  offset: number
}

/** Place un fragment selon ce que la gerbe raconte. Le résultat est dans `dummy`. */
function place(kind: Gerbe['kind'], seed: Seed, t: number, at: [number, number, number]): void {
  const [ax, ay, az] = at
  const fade = 1 - t

  if (kind === 'confetti') {
    // Elles tombent de haut sur toute la table en tournoyant. Chacune part de sa propre
    // hauteur et descend à son propre rythme : aucune ne reboucle, et rien ne saute.
    const drop = t * (3.6 + seed.offset * 2.4)
    dummy.position.set(
      ax + seed.dir.x * 4.6 + Math.sin(t * 5 + seed.offset * 7) * 0.45,
      ay + seed.offset * 3 - drop,
      az + seed.dir.z * 3.2,
    )
    dummy.rotation.set(t * seed.spin, t * seed.spin * 1.6, 0)
    // Rectangulaires : un confetti carré se lit comme une poussière. Plus petits que
    // les éclats, aussi — il y en a quinze fois plus, et ils tombent sur toute la table.
    dummy.scale.set(seed.size * 1.1, seed.size * 0.65, 1)
  } else if (kind === 'rise') {
    dummy.position.set(
      ax + seed.dir.x * seed.speed * 0.45,
      ay + t * (1.4 + seed.offset * 1.3),
      az + seed.dir.z * seed.speed * 0.45,
    )
    dummy.rotation.set(0, t * seed.spin * 0.3, t * seed.spin * 0.2)
    dummy.scale.setScalar(seed.size * fade)
  } else {
    // Éclatement : les fragments partent vite, la pesanteur les rattrape.
    const reach = seed.speed * t * 1.7
    dummy.position.set(
      ax + seed.dir.x * reach,
      ay + seed.dir.y * reach - 3.1 * t * t,
      az + seed.dir.z * reach,
    )
    dummy.rotation.set(t * seed.spin, t * seed.spin * 0.7, 0)
    dummy.scale.setScalar(seed.size * fade)
  }

  dummy.updateMatrix()
}

export function Burst() {
  const mesh = useRef<THREE.InstancedMesh>(null)
  const burst = useStage((state) => state.burst)
  const reducedMotion = useSettings((state) => state.reducedMotion)

  /**
   * Fragments tirés une fois pour toutes.
   *
   * Une gerbe n'a pas besoin d'être inédite, elle a besoin d'être immédiate : tirer au
   * sort au moment de l'explosion ferait travailler le fil principal précisément quand
   * il a le plus à faire.
   */
  const seeds = useMemo<Seed[]>(
    () =>
      Array.from({ length: MAX }, () => ({
        dir: new THREE.Vector3(
          Math.random() * 2 - 1,
          Math.random() * 0.9 + 0.1,
          Math.random() * 2 - 1,
        ).normalize(),
        speed: 0.7 + Math.random() * 1.6,
        spin: (Math.random() * 2 - 1) * 7,
        size: 0.055 + Math.random() * 0.075,
        offset: Math.random(),
      })),
    [],
  )

  // Les couleurs ne changent qu'avec la gerbe : les réécrire à chaque image enverrait
  // un tampon entier pour rien.
  useEffect(() => {
    const node = mesh.current
    if (!node || !burst) return
    for (let i = 0; i < MAX; i++) {
      // La victoire se fête en couleurs de sièges : c'est toute la table qui est là.
      const color =
        burst.kind === 'confetti' ? SEAT_COLORS[i % SEAT_COLORS.length]! : burst.color
      node.setColorAt(i, tint.set(color))
    }
    if (node.instanceColor) node.instanceColor.needsUpdate = true
  }, [burst])

  useFrame(() => {
    const node = mesh.current
    if (!node) return

    const current = useStage.getState().burst
    if (!current || reducedMotion) {
      node.visible = false
      return
    }

    const t = (performance.now() - current.startedAt) / LIFE[current.kind]
    if (t < 0 || t > 1) {
      node.visible = false
      return
    }

    node.visible = true
    node.count = Math.min(MAX, current.count)
    for (let i = 0; i < node.count; i++) {
      place(current.kind, seeds[i]!, t, current.at)
      node.setMatrixAt(i, dummy.matrix)
    }
    node.instanceMatrix.needsUpdate = true

    // Les éclats s'éteignent en rapetissant ; les confettis, eux, gardent leur taille
    // et doivent donc disparaître autrement qu'en s'évaporant d'un coup.
    const material = node.material as THREE.MeshBasicMaterial
    material.opacity = current.kind === 'confetti' ? Math.min(1, (1 - t) * 5) : 0.95
  })

  return (
    <instancedMesh
      ref={mesh}
      args={[undefined, undefined, MAX]}
      // Les fragments sortent largement de la boîte englobante calculée au montage :
      // sans cela, la gerbe disparaît dès qu'elle s'éloigne de son point de départ.
      frustumCulled={false}
      visible={false}
    >
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial transparent depthWrite={false} toneMapped={false} side={THREE.DoubleSide} />
    </instancedMesh>
  )
}
