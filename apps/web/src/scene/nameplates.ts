import * as THREE from 'three'
import type { Camera } from 'three'
import { platePosition } from './seats'

/**
 * Plaques de nom : du DOM ordinaire, positionné à la main.
 *
 * Elles étaient rendues dans la scène via `<Html>` de drei, qui monte une racine React
 * par plaque. Avec React 19, l'une d'elles disparaissait silencieusement — toujours le
 * premier siège — et le navigateur se plaignait d'un démontage pendant le rendu. Les
 * projeter soi-même supprime le bug, supprime le bruit, et évite une racine React par
 * joueur : on ne fait plus que déplacer un `div` existant à chaque image.
 */

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), Math.max(min, max))
}

const elements = new Map<string, HTMLElement>()
const anchor = new THREE.Vector3()

export function registerPlate(playerId: string, element: HTMLElement | null): void {
  if (element) elements.set(playerId, element)
  else elements.delete(playerId)
}

export function projectPlates(
  camera: Camera,
  size: { width: number; height: number },
  seats: { id: string; seat: number }[],
  mySeat: number,
): void {
  for (const { id, seat } of seats) {
    const element = elements.get(id)
    if (!element) continue

    anchor.set(...platePosition(seat, mySeat, seats.length)).project(camera)

    // z supérieur à 1 : le point est derrière la caméra, la plaque n'a rien à montrer.
    const visible = anchor.z < 1
    element.style.opacity = visible ? '1' : '0'
    if (!visible) continue

    // Les plaques ont une taille fixe : sans bornes, celles des sièges latéraux
    // sortiraient du cadre et se feraient couper à moitié.
    const halfWidth = element.offsetWidth / 2
    const halfHeight = element.offsetHeight / 2
    const x = clamp((anchor.x * 0.5 + 0.5) * size.width, halfWidth + 6, size.width - halfWidth - 6)
    const y = clamp(
      (-anchor.y * 0.5 + 0.5) * size.height,
      halfHeight + 6,
      size.height - halfHeight - 6,
    )
    element.style.transform = `translate(-50%, -50%) translate(${x}px, ${y}px)`
  }
}
