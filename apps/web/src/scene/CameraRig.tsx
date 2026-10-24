import { useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { impactDecay, useStage } from './stage'
import { useSettings } from '../settings'
import { layout, seatPosition } from './seats'

const SHAKE_MS = 420

/** Vecteur de travail réutilisé : allouer dans la boucle de rendu provoque des saccades. */
const scratch = new THREE.Vector3()

/**
 * Caméra vivante.
 *
 * Au repos elle respire à peine. Elle se penche vers le joueur qui déclenche un
 * super-pouvoir, et encaisse une secousse à chaque impact. Tout passe par un
 * amortissement vers une cible : aucun mouvement n'est brusque, et couper les animations
 * revient simplement à viser la position de repos.
 */
export function CameraRig({ mySeat, total }: { mySeat: number; total: number }) {
  const camera = useThree((state) => state.camera)
  const size = useThree((state) => state.size)
  const target = useRef(new THREE.Vector3())
  const look = useRef(new THREE.Vector3(0, 0, 0))

  // Ajustement résiduel pour les formats intermédiaires : la disposition fait déjà
  // l'essentiel du travail, la caméra ne corrige que le reste.
  const fit = Math.min(1.35, Math.max(1, 1.45 / (size.width / size.height)))

  useFrame((state, delta) => {
    const { focusSeat, impactAt, impactPower } = useStage.getState()
    const { reducedMotion } = useSettings.getState()

    const { camera: base, fov } = layout()
    // Le Canvas ne lit ses propriétés de caméra qu'au montage : c'est ici que le champ
    // de vision suit un changement de format.
    if ('fov' in camera && camera.fov !== fov) {
      camera.fov = fov
      camera.updateProjectionMatrix()
    }

    const [bx, by, bz] = base
    target.current.set(bx, by, bz).multiplyScalar(fit)
    look.current.set(0, 0, 0)

    if (!reducedMotion) {
      if (focusSeat !== undefined) {
        const [x, , z] = seatPosition(focusSeat, mySeat, total)
        // On se rapproche du siège visé sans jamais lui tourner autour : le repère
        // spatial de la table doit rester stable.
        target.current.lerp(scratch.set(x * 0.45, 5.6 * fit, (z * 0.4 + 6.2) * fit), 0.85)
        look.current.set(x * 0.3, 0.4, z * 0.3)
      }

      const shake = impactDecay(impactAt, impactPower, SHAKE_MS)
      if (shake > 0) {
        const time = state.clock.elapsedTime * 60
        target.current.x += Math.sin(time * 1.7) * shake * 0.22
        target.current.y += Math.sin(time * 2.3) * shake * 0.16
      }

      // Respiration permanente : sans elle, la scène semble figée entre deux coups.
      target.current.y += Math.sin(state.clock.elapsedTime * 0.5) * 0.06
    }

    const ease = 1 - Math.exp(-delta * 4)
    camera.position.lerp(target.current, ease)
    camera.lookAt(look.current)
  })

  return null
}
