import { useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { impactDecay, useStage } from './stage'
import { useSettings } from '../settings'
import { layout, seatPosition } from './seats'

const SHAKE_MS = 420

/** Durée du tour d'honneur, fondu de sortie compris. */
const ORBIT_S = 7

/** Vecteur de travail réutilisé : allouer dans la boucle de rendu provoque des saccades. */
const scratch = new THREE.Vector3()

/**
 * Caméra vivante.
 *
 * Au repos elle dérive à peine. Elle se penche vers celui qui joue — franchement sur un
 * super-pouvoir, à peine sur un coup ordinaire — et encaisse une secousse à chaque
 * impact. Tout passe par un amortissement vers une cible : aucun mouvement n'est
 * brusque, et couper les animations revient simplement à viser la position de repos.
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
    const { focusSeat, focusPower, celebration, impactAt, impactPower } = useStage.getState()
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
        const pull = 0.85 * focusPower
        target.current.lerp(scratch.set(x * 0.45, 5.6 * fit, (z * 0.4 + 6.2) * fit), pull)
        look.current.lerp(scratch.set(x * 0.3, 0.4, z * 0.3), focusPower)
      }

      if (celebration) {
        // Tour d'honneur : le seul endroit où l'on tourne autour de la table. Ailleurs
        // le repère spatial doit rester stable, sous peine de ne plus savoir qui est
        // assis où ; ici la partie est finie, et il n'y a plus de place à repérer.
        //
        // L'orbite s'ouvre et se referme toute seule, pour que la caméra retrouve sa
        // position de repos sans que personne ait à l'y rappeler — attendre la fin
        // d'une révérence bloquerait la file d'actions.
        const seconds = (performance.now() - celebration.startedAt) / 1000
        const weight = Math.min(1, seconds / 0.6) * Math.max(0, Math.min(1, (ORBIT_S - seconds) / 1.5))
        if (weight > 0) {
          const [x, , z] = seatPosition(celebration.seat, mySeat, total)
          const angle = Math.atan2(x, z) + seconds * 0.45
          const radius = 8.2 * fit
          const around = scratch.set(Math.sin(angle) * radius, 4.8 * fit, Math.cos(angle) * radius)
          target.current.lerp(around, weight)
          look.current.lerp(scratch.set(x * 0.45, 0.7, z * 0.45), weight)
        }
      }

      const shake = impactDecay(impactAt, impactPower, SHAKE_MS)
      if (shake > 0) {
        const time = state.clock.elapsedTime * 60
        target.current.x += Math.sin(time * 1.7) * shake * 0.22
        target.current.y += Math.sin(time * 2.3) * shake * 0.16
        // Et l'on se jette brièvement en avant : la secousse seule tremble, elle ne
        // frappe pas.
        target.current.multiplyScalar(1 - shake * 0.035)
      }

      // Respiration permanente : sans elle, la scène semble figée entre deux coups. Le
      // balancement est volontairement plus lent que la respiration — superposés, deux
      // mouvements de même période se liraient comme un seul tremblement.
      const time = state.clock.elapsedTime
      target.current.y += Math.sin(time * 0.5) * 0.06
      target.current.x += Math.sin(time * 0.21) * 0.18
    }

    const ease = 1 - Math.exp(-delta * 4)
    camera.position.lerp(target.current, ease)
    camera.lookAt(look.current)
  })

  return null
}
