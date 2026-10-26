/**
 * Les visages dont on dispose pour se représenter à la table.
 *
 * Ni images ni emoji : chaque visage est un jeu de paramètres que le client dessine en
 * SVG. Rien à charger, rien à héberger, net à toutes les tailles — et une nouvelle tête
 * coûte une ligne ici plus un tracé côté client.
 *
 * Le catalogue vit dans le moteur parce que le serveur doit valider ce qu'un client
 * envoie : sans quoi n'importe qui se donnerait un avatar arbitraire. Les couleurs y
 * figurent aussi, bien qu'elles relèvent de l'apparence — un identifiant seul laisserait
 * deux listes exister, et deux listes finissent par diverger.
 */

/** Coupe de cheveux, qui est aussi ce que le client sait tracer. */
export type HairStyle =
  | 'buzz'
  | 'short'
  | 'curls'
  | 'afro'
  | 'waves'
  | 'long'
  | 'bob'
  | 'bun'
  | 'ponytail'
  | 'locs'
  | 'bald'
  | 'scarf'

export type Avatar = {
  readonly id: HairStyle
  readonly hair: HairStyle
  /** Teint. */
  readonly skin: string
  /** Couleur des cheveux — ou du tissu, pour le visage qui porte un foulard. */
  readonly hairColor: string
  /** Couleur du vêtement : sans elle, les épaules se confondraient avec le fond. */
  readonly outfit: string
  /** Fond du portrait, assez sourd pour que le visage reste lisible par-dessus. */
  readonly backdrop: string
  readonly beard?: 'full' | 'stubble'
}

/**
 * Douze visages, et douze teints différents.
 *
 * Chaque entrée change de coupe *et* de carnation plutôt que de décliner la même tête :
 * à douze places, c'est ce qui donne le plus de chances à chacun de se reconnaître. Rien
 * n'y est genré, ni dans les identifiants ni dans les libellés — une coupe ne dit pas qui
 * la porte.
 */
export const AVATARS: readonly Avatar[] = [
  { id: 'buzz', hair: 'buzz', skin: '#6b4228', hairColor: '#15100c', outfit: '#2f6f9f', backdrop: '#1e3a5f', beard: 'stubble' },
  { id: 'short', hair: 'short', skin: '#e3b68f', hairColor: '#8a6a46', outfit: '#3f7f5f', backdrop: '#1f4a3a' },
  { id: 'curls', hair: 'curls', skin: '#a86a3f', hairColor: '#2a1a12', outfit: '#b4543f', backdrop: '#5a2a24' },
  { id: 'afro', hair: 'afro', skin: '#5f3a22', hairColor: '#2f2017', outfit: '#c9a227', backdrop: '#40320f' },
  { id: 'waves', hair: 'waves', skin: '#f0cfae', hairColor: '#c9843a', outfit: '#7a5cc0', backdrop: '#342a5e' },
  { id: 'long', hair: 'long', skin: '#d49b6a', hairColor: '#241a14', outfit: '#d9578a', backdrop: '#5a2244' },
  { id: 'bob', hair: 'bob', skin: '#f3d9bd', hairColor: '#b8451f', outfit: '#2f8f8f', backdrop: '#15454a' },
  { id: 'bun', hair: 'bun', skin: '#8a5632', hairColor: '#1a1210', outfit: '#6fae4a', backdrop: '#2a4a1e' },
  { id: 'ponytail', hair: 'ponytail', skin: '#c98a5c', hairColor: '#e0c070', outfit: '#4a6fd0', backdrop: '#26376e' },
  { id: 'locs', hair: 'locs', skin: '#5a361f', hairColor: '#2b1b14', outfit: '#d08a2a', backdrop: '#543412' },
  { id: 'bald', hair: 'bald', skin: '#e8c0a0', hairColor: '#8a8f99', outfit: '#5a6472', backdrop: '#2d3340', beard: 'full' },
  { id: 'scarf', hair: 'scarf', skin: '#9c6239', hairColor: '#b04a7a', outfit: '#3b3f6b', backdrop: '#46254a' },
]

export type AvatarId = Avatar['id']

export const DEFAULT_AVATAR: AvatarId = 'buzz'

export function isAvatar(value: string): value is AvatarId {
  return AVATARS.some((avatar) => avatar.id === value)
}

/** Ramène n'importe quelle entrée à un avatar connu. */
export function toAvatar(value: string | undefined): AvatarId {
  return value && isAvatar(value) ? value : DEFAULT_AVATAR
}

/**
 * Le visage à dessiner pour un identifiant.
 *
 * Ne renvoie jamais `undefined` : un identifiant inconnu — un vieil avatar resté dans le
 * stockage local d'un joueur, par exemple — retombe sur le visage par défaut plutôt que
 * de laisser un trou dans la table.
 */
export function findAvatar(id: string): Avatar {
  return AVATARS.find((avatar) => avatar.id === id) ?? AVATARS[0]!
}
