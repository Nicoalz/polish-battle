import { CARD_HEIGHT, CARD_WIDTH } from './textures'

/**
 * Placement des joueurs autour de la table.
 *
 * Le joueur local occupe toujours le bas de l'écran : les sièges sont posés sur une
 * ellipse et tournés de sorte que ma place tombe à l'angle zéro. Le repère reste donc
 * stable d'une partie à l'autre, quel que soit mon siège réel.
 */

/**
 * Forme de la table.
 *
 * Sur un écran large, l'ellipse est couchée ; sur un téléphone en portrait, elle se
 * redresse. Garder la même table en reculant simplement la caméra laisserait les sièges
 * latéraux hors cadre : c'est la disposition qui doit suivre le format, pas la distance.
 *
 * L'état est volontairement un module : une seule table existe à la fois, et la calculer
 * en paramètre obligerait à la faire transiter jusque dans le chef d'orchestre.
 */
export const LAYOUTS = {
  wide: { radiusX: 4.25, radiusZ: 2.75, fov: 38, camera: [0, 7.6, 9.2] as const },
  tall: { radiusX: 2.5, radiusZ: 3.5, fov: 50, camera: [0, 9.0, 11.0] as const },
} as const

export type LayoutName = keyof typeof LAYOUTS

let current: LayoutName = 'wide'

export function setLayout(name: LayoutName): void {
  current = name
}

export function layout() {
  return LAYOUTS[current]
}

export function seatAngle(seat: number, mySeat: number, total: number): number {
  const offset = (((seat - mySeat) % total) + total) % total
  return (offset / total) * Math.PI * 2
}

export function seatPosition(
  seat: number,
  mySeat: number,
  total: number,
): [number, number, number] {
  const angle = seatAngle(seat, mySeat, total)
  const { radiusX, radiusZ } = layout()
  return [Math.sin(angle) * radiusX, 0, Math.cos(angle) * radiusZ]
}

/** Point visé par les animations qui arrivent sur un siège, à la hauteur voulue. */
export function seatAnchor(
  seat: number,
  mySeat: number,
  total: number,
  height: number,
): [number, number, number] {
  const [x, , z] = seatPosition(seat, mySeat, total)
  return [x, height, z]
}

/** Échelle du groupe d'un siège : le joueur local est un peu plus grand. */
export function seatScale(isMe: boolean): number {
  return isMe ? 1.12 : 0.92
}

/**
 * Point d'ancrage de la place d'un joueur, côté extérieur de la table.
 *
 * Calculé ici plutôt que dans le composant : la plaque n'est plus rendue dans la scène
 * 3D mais projetée à l'écran, et les deux doivent viser exactement le même endroit.
 *
 * Le recul est plus franc depuis qu'un portrait occupe la place : une vignette de seize
 * pixels tenait au ras des cartes, un visage de cinquante leur passerait dessus.
 */
export function platePosition(
  seat: number,
  mySeat: number,
  total: number,
): [number, number, number] {
  const angle = seatAngle(seat, mySeat, total)
  const [x, , z] = seatPosition(seat, mySeat, total)
  const scale = seatScale(seat === mySeat)
  return [x + Math.sin(angle) * 1.5 * scale, 2.15 * scale, z + Math.cos(angle) * 1.5 * scale]
}

/**
 * Disposition d'une main sur son siège.
 *
 * Elle vivait dans le composant du siège, qui était seul à en avoir besoin. La
 * distribution doit maintenant viser exactement les mêmes emplacements : deux copies
 * de ces mesures se décaleraient au premier ajustement, et les cartes atterriraient à
 * côté de leur place.
 */

/** Les cartes sont inclinées vers la caméra : lisibles de partout, mais posées sur la table. */
export const TILT = -Math.PI / 3.1
export const CARD_TILT: [number, number, number] = [TILT, 0, 0]

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

export type HandSlot =
  | { kind: 'life'; index: number }
  | { kind: 'shield' }
  | { kind: 'battery' }

/** Demi-largeur de la rangée de vie : tout le reste se place par rapport à elle. */
function lifeWidth(lifeCount: number): number {
  return Math.max(0, lifeCount - 1) * SPACING
}

/** Position d'une carte dans le repère de son siège. */
export function slotLocal(slot: HandSlot, lifeCount: number): [number, number, number] {
  const width = lifeWidth(lifeCount)
  if (slot.kind === 'life') return [slot.index * SPACING - width / 2, ROW_Y, 0]
  if (slot.kind === 'battery') return [width / 2 + SPACING, ROW_Y, 0]

  const [y, z] = alongCard(CARD_HEIGHT / 2 + CARD_WIDTH / 2 + 0.09)
  return [0, ROW_Y + y, z]
}

/** Rayon du halo au sol, qui doit contenir la main entière. */
export function handRadius(lifeCount: number, hasBattery: boolean): number {
  const reach = hasBattery
    ? lifeWidth(lifeCount) / 2 + SPACING + CARD_WIDTH / 2
    : lifeWidth(lifeCount) / 2
  return Math.max(1.05, reach + 0.45)
}

/** Position d'une carte dans la scène, siège et échelle compris. */
export function slotWorld(
  seat: number,
  mySeat: number,
  total: number,
  slot: HandSlot,
  lifeCount: number,
): [number, number, number] {
  const [x, , z] = seatPosition(seat, mySeat, total)
  const scale = seatScale(seat === mySeat)
  const [lx, ly, lz] = slotLocal(slot, lifeCount)
  return [x + lx * scale, ly * scale, z + lz * scale]
}

/** Où se pose la carte piochée : au centre, au-dessus du paquet. */
export const DRAWN_CARD_POSITION: [number, number, number] = [0, 1.05, 0.9]

/** Position du paquet, d'où partent les cartes piochées. */
export const DECK_POSITION: [number, number, number] = [0, 0.04, -1.0]

/** Couleur d'identité d'un joueur, stable pour toute la partie. */
export const SEAT_COLORS = [
  '#34d399',
  '#60a5fa',
  '#f472b6',
  '#fbbf24',
  '#a78bfa',
  '#2dd4bf',
  '#fb7185',
  '#facc15',
] as const

export function seatColor(seat: number): string {
  return SEAT_COLORS[seat % SEAT_COLORS.length]!
}
