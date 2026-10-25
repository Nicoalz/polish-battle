/**
 * Jetons dont on se sert pour se représenter à la table.
 *
 * Des caractères, pas des images : rien à charger, rien à héberger, et ils restent nets
 * à toutes les tailles. La liste vit dans le moteur parce que le serveur doit valider ce
 * qu'un client envoie — sans quoi n'importe qui pourrait se donner un nom de deux cents
 * caractères en guise d'avatar.
 */
export const AVATARS = [
  '🦊',
  '🐺',
  '🦉',
  '🐙',
  '🐸',
  '🦁',
  '🐼',
  '🦝',
  '🐲',
  '🦈',
  '🐝',
  '🦄',
] as const

export type Avatar = (typeof AVATARS)[number]

export const DEFAULT_AVATAR: Avatar = AVATARS[0]

export function isAvatar(value: string): value is Avatar {
  return (AVATARS as readonly string[]).includes(value)
}

/** Ramène n'importe quelle entrée à un avatar connu. */
export function toAvatar(value: string | undefined): Avatar {
  return value && isAvatar(value) ? value : DEFAULT_AVATAR
}
