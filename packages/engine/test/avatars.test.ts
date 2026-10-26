import { describe, expect, it } from 'vitest'
import { AVATARS, DEFAULT_AVATAR, findAvatar, toAvatar } from '../src/avatars'

describe('le catalogue de visages', () => {
  it('n’a pas deux fois le même identifiant', () => {
    // Un doublon passerait inaperçu : la grille afficherait deux portraits, et les deux
    // joueurs qui les choisissent se retrouveraient avec le même visage à la table.
    expect(new Set(AVATARS.map((face) => face.id)).size).toBe(AVATARS.length)
  })

  it('donne à chaque visage un teint qui lui est propre', () => {
    expect(new Set(AVATARS.map((face) => face.skin)).size).toBe(AVATARS.length)
  })

  it('ramène une valeur inconnue au visage par défaut', () => {
    // Les premiers joueurs ont un emoji dans leur stockage local : il ne doit ni fuiter
    // jusqu'au serveur, ni laisser la grille sans sélection.
    expect(toAvatar('🦊')).toBe(DEFAULT_AVATAR)
    expect(toAvatar(undefined)).toBe(DEFAULT_AVATAR)
    expect(toAvatar('scarf')).toBe('scarf')
  })

  it('a toujours un visage à dessiner', () => {
    expect(findAvatar('inconnu').id).toBe(DEFAULT_AVATAR)
    for (const face of AVATARS) expect(findAvatar(face.id)).toBe(face)
  })
})
