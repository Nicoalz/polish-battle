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

/**
 * Bande haute réservée à l'en-tête.
 *
 * Les places sont désormais des portraits, et celle du siège le plus éloigné tombe
 * pile sous le bandeau de tour. On l'arrête donc au-dessous plutôt que de la laisser
 * monter jusqu'au bord. Sur écran étroit l'en-tête occupe trois lignes.
 */
/** Au-delà de cette distance au centre, en coordonnées normalisées, la place est hors jeu. */
const OFFSCREEN = 1.25

function topInset(width: number): number {
  return width < 640 ? 118 : 56
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
    //
    // Très au-delà du cadre non plus : les bornes ci-dessous ramènent les sièges
    // latéraux dans l'écran, ce qu'on veut en jeu, mais pendant le tour d'honneur la
    // caméra fait carrément sortir des places du champ — épinglée au coin, l'une
    // d'elles se lirait comme un joueur assis là.
    const visible = anchor.z < 1 && Math.abs(anchor.x) < OFFSCREEN && Math.abs(anchor.y) < OFFSCREEN
    element.style.opacity = visible ? '1' : '0'
    if (!visible) continue

    // Les plaques ont une taille fixe : sans bornes, celles des sièges latéraux
    // sortiraient du cadre et se feraient couper à moitié.
    const halfWidth = element.offsetWidth / 2
    const halfHeight = element.offsetHeight / 2
    const x = clamp((anchor.x * 0.5 + 0.5) * size.width, halfWidth + 6, size.width - halfWidth - 6)
    const y = clamp(
      (-anchor.y * 0.5 + 0.5) * size.height,
      halfHeight + topInset(size.width),
      size.height - halfHeight - 6,
    )
    element.style.transform = `translate(-50%, -50%) translate(${x}px, ${y}px)`
  }
}
