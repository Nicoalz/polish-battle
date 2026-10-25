/**
 * Types du moteur de Polish Battle.
 *
 * Tout l'état est de la donnée brute sérialisable : aucune classe, aucune méthode,
 * aucune référence circulaire. C'est ce qui permet de le cloner, de le miroiter dans
 * un schéma Colyseus et de l'inspecter dans les tests sans cérémonie.
 */

export type Card = {
  /** Identifiant unique et stable : clé de rendu et cible d'animation côté client. */
  id: string
  /** Valeur telle que tirée. N'est jamais modifiée : elle dit si la carte est entamée. */
  rank: number
  /** Valeur effective courante. Baisse quand une carte de vie est entamée. */
  value: number
}

export type Phase = 'lobby' | 'playing' | 'finished'

export type PlayerState = {
  id: string
  name: string
  /** Jeton choisi pour se représenter à la table. */
  avatar: string
  /** Position à la table, égale à l'index dans `players`. */
  seat: number
  /** Cartes de vie, consommées en file (la plus ancienne encaisse en premier). */
  life: Card[]
  shield: Card
  battery?: Card
  hasSuperPower: boolean
  connected: boolean
  isHost: boolean
}

export type GameState = {
  phase: Phase
  players: PlayerState[]
  turnSeat: number
  winnerId?: string
  /** Graine du générateur pseudo-aléatoire : l'état est entièrement reproductible. */
  rng: number
  /** Compteur d'identifiants de cartes. */
  cardSeq: number
}

/**
 * Un coup se choisit **avant** de connaître la carte.
 *
 * C'est le cœur du jeu : on s'engage sur une action et une cible, puis seulement la
 * carte se révèle. Attaquer, c'est parier ; changer un bouclier aussi, dans les deux
 * sens. Il n'existe donc pas d'action « piocher » : chaque coup tire sa propre carte.
 */
export type Action =
  | { type: 'attack'; targetId: string }
  | { type: 'shield'; targetId: string }
  | { type: 'charge'; targetId: string }
  | { type: 'super-attack'; targetId: string }
  | { type: 'super-shield'; targetId: string }
  | { type: 'resurrect'; targetId: string }

export type ActionType = Action['type']

/**
 * Ce qui s'est passé, dans l'ordre où ça s'est passé.
 *
 * C'est le flux que le client rejoue pour animer la scène : chaque événement porte
 * les identifiants et les valeurs avant/après, de sorte que l'animation n'a jamais
 * besoin de deviner quoi que ce soit en comparant deux états.
 */
export type GameEvent =
  | { t: 'game-started' }
  /** La carte se dévoile, une fois le coup engagé. Une charge, elle, ne révèle rien. */
  | { t: 'drawn'; playerId: string; card: Card }
  | {
      t: 'attack-resolved'
      fromId: string
      toId: string
      /** Carte piochée, plus la batterie si elle a été dépensée. */
      cards: Card[]
      /** Dégâts avant déduction du bouclier. */
      raw: number
      shieldValue: number
      /** Dégâts réellement infligés à la vie. */
      dealt: number
      kind: 'normal' | 'super'
    }
  | { t: 'life-damaged'; playerId: string; cardId: string; from: number; to: number }
  | { t: 'life-destroyed'; playerId: string; card: Card }
  | { t: 'shield-set'; playerId: string; byId: string; card: Card; kind: 'normal' | 'super' }
  | { t: 'battery-set'; playerId: string; byId: string; card: Card }
  | { t: 'battery-lost'; playerId: string; reason: 'spent' | 'broken' }
  | { t: 'super-used'; playerId: string; kind: 'super-attack' | 'super-shield' | 'resurrect' }
  | { t: 'resurrected'; playerId: string; byId: string }
  | { t: 'player-died'; playerId: string }
  | { t: 'turn-changed'; seat: number; playerId: string }
  | { t: 'game-won'; playerId: string }

export type EventType = GameEvent['t']

/** Résultat d'une transition : le nouvel état, et le récit de ce qui s'est passé. */
export type ApplyResult = {
  state: GameState
  events: GameEvent[]
}
