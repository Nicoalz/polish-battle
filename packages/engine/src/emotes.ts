/**
 * Réactions de table.
 *
 * Un jeu de soirée vit de ses « oooh ». La liste vit ici, avec celle des visages, pour
 * la même raison : le serveur valide ce qui passe, et personne ne peut faire circuler
 * une réaction que les autres ne sauraient pas afficher.
 *
 * Une réaction n'est pas un coup. Elle n'entre dans aucun état, ne fait avancer aucune
 * version, et ne laisse aucune trace — ce qui durerait deviendrait un message, et une
 * table de jeu n'a pas besoin d'une messagerie.
 */

export const EMOTES = ['👏', '😮', '😂', '😱', '🔥', '💀'] as const

export type Emote = (typeof EMOTES)[number]

export function isEmote(value: unknown): value is Emote {
  return typeof value === 'string' && (EMOTES as readonly string[]).includes(value)
}

/**
 * Intervalle minimal entre deux réactions d'un même joueur.
 *
 * Sans lui, un seul joueur couvre la table : six boutons et une main sur la souris
 * suffisent à rendre les cinq autres illisibles.
 */
export const EMOTE_COOLDOWN_MS = 1200

/** Durée d'affichage d'une bulle, côté client. Elle en règle aussi l'animation. */
export const EMOTE_TTL_MS = 2400
