import type { Card, GameState, PlayerState } from './types'

/**
 * Forme sérialisée de l'état, et lecture de cette forme.
 *
 * Le moteur ne connaît pas le réseau, mais il sait relire son propre état une fois
 * aplati en JSON. Mettre cette lecture ici évite d'en entretenir deux copies — une
 * dans le client, une dans le test de bout en bout — qui divergent au premier
 * changement de schéma.
 */

export type WireCard = { id: string; rank: number; value: number }

export type WirePlayer = {
  id: string
  name: string
  avatar: string
  seat: number
  life: WireCard[]
  shield: WireCard
  battery?: WireCard
  hasSuperPower: boolean
  connected: boolean
  isHost: boolean
}

export type WireGame = {
  code: string
  phase: string
  players: WirePlayer[]
  turnSeat: number
  winnerId: string
  version: number
}

/** Emplacements dont la carte est remplacée par un jeton avant d'être transmise. */
export type HiddenSlot = 'battery'

/**
 * Identifiant d'une carte masquée.
 *
 * Il désigne un emplacement, jamais une carte : réutiliser l'identifiant réel
 * laisserait recouper la charge avec un autre événement. Serveur et client partagent
 * cette convention.
 */
export function hiddenCardId(slot: HiddenSlot, playerId: string): string {
  return `${slot}:${playerId}`
}

export function hiddenCard(slot: HiddenSlot, playerId: string): Card {
  return { id: hiddenCardId(slot, playerId), rank: 0, value: 0 }
}

export function isHiddenCard(card: Pick<Card, 'id'>): boolean {
  return card.id.startsWith('battery:')
}

function toCard(card: WireCard): Card {
  return { id: card.id, rank: card.rank, value: card.value }
}

function toPlayer(player: WirePlayer): PlayerState {
  return {
    id: player.id,
    name: player.name,
    avatar: player.avatar,
    seat: player.seat,
    life: (player.life ?? []).map(toCard),
    shield: toCard(player.shield),
    battery: player.battery ? toCard(player.battery) : undefined,
    hasSuperPower: player.hasSuperPower,
    connected: player.connected,
    isHost: player.isHost,
  }
}

/**
 * Reconstruit un état de jeu à partir de sa forme sérialisée.
 *
 * `rng` et `cardSeq` ne sont jamais transmis : ils ne servent qu'à produire des cartes,
 * ce que seul le serveur a le droit de faire.
 */
export function fromWire(raw: WireGame): GameState {
  return {
    phase: raw.phase as GameState['phase'],
    players: (raw.players ?? []).map(toPlayer),
    turnSeat: raw.turnSeat,
    winnerId: raw.winnerId || undefined,
    rng: 0,
    cardSeq: 0,
  }
}
