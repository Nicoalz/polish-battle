import { schema, type SchemaType } from '@colyseus/schema'

/**
 * Miroir synchronisé de l'état du moteur.
 *
 * Le moteur ignore totalement Colyseus : il manipule de la donnée brute. Ce fichier
 * est la seule frontière entre les deux, pour que les règles restent testables sans
 * serveur et que la synchro binaire reste un détail de transport.
 *
 * Personne ne garde de carte en main : un coup se choisit à l'aveugle et tire sa propre
 * carte au moment de se résoudre. Le seul secret de la table est la charge, dont la
 * valeur ne quitte jamais le serveur.
 */

export const CardSchema = schema(
  {
    id: 'string',
    rank: 'uint8',
    value: 'uint8',
  },
  'Card',
)
export type CardSchema = SchemaType<typeof CardSchema>

export const PlayerSchema = schema(
  {
    id: 'string',
    name: 'string',
    avatar: 'string',
    seat: 'uint8',
    life: [CardSchema],
    shield: CardSchema,
    // Absente la plupart du temps : la référence reste simplement indéfinie.
    battery: CardSchema,
    hasSuperPower: 'boolean',
    connected: 'boolean',
    isHost: 'boolean',
    /** Dérivé de la somme des cartes de vie : évite de le recalculer côté client. */
    alive: 'boolean',
  },
  'Player',
)
export type PlayerSchema = SchemaType<typeof PlayerSchema>

/** Réglages de la partie. Ils ne changent qu'au salon, mais tout le monde les voit. */
export const OptionsSchema = schema(
  {
    mirrorStart: { type: 'boolean', default: false },
  },
  'Options',
)
export type OptionsSchema = SchemaType<typeof OptionsSchema>

export const GameSchema = schema(
  {
    code: { type: 'string', default: '' },
    options: OptionsSchema,
    phase: { type: 'string', default: 'lobby' },
    players: [PlayerSchema],
    turnSeat: { type: 'uint8', default: 0 },
    winnerId: { type: 'string', default: '' },
    /**
     * Incrémenté à chaque action appliquée. Accompagne le lot d'événements diffusé,
     * pour que le client sache à quelle version de l'état son animation aboutit.
     */
    version: { type: 'uint32', default: 0 },
  },
  'Game',
)
export type GameSchema = SchemaType<typeof GameSchema>
