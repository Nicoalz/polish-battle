import type { ActionType, AvatarId, IllegalActionCode } from '@pb/engine'

/** Motifs de refus : ceux du moteur, plus ceux propres au serveur. */
export type RejectionCode =
  | IllegalActionCode
  | 'host-only'
  | 'unknown-action'
  | 'not-during-game'

export type Locale = 'fr' | 'en'

/**
 * Toutes les chaînes de l'interface, en un seul endroit.
 *
 * Les textes à trous sont des fonctions plutôt que des gabarits : le typage garantit
 * qu'aucune traduction n'oublie un paramètre, et aucune bibliothèque n'est nécessaire.
 */
export type Dict = {
  readonly localeName: string

  readonly app: {
    readonly title: string
    readonly devNotice: string
  }

  readonly home: {
    readonly tagline: string
    readonly avatar: string
    readonly joinByCode: string
    readonly create: string
    readonly createPublic: string
    readonly createPrivate: string
    readonly visibilityHint: string
    readonly openRooms: string
    readonly noRooms: string
    readonly players: (count: number) => string
    readonly inProgress: string
  }

  readonly lobby: {
    readonly nickname: string
    readonly nicknamePlaceholder: string
    readonly roomCode: string
    readonly roomCodePlaceholder: string
    readonly join: string
    readonly joining: string
    readonly createRoom: string
    readonly connectionFailed: string
  }

  readonly table: {
    readonly waiting: string
    readonly turnOf: (name: string) => string
    readonly wins: (name: string) => string
    readonly leave: string
    readonly start: string
    readonly restart: string
    readonly skipTurn: string
    readonly kick: string
    readonly yourTurn: string
    readonly chooseAction: string
    readonly secondsLeft: (seconds: number) => string
    readonly chooseTarget: (action: string) => string
    readonly log: string
    readonly reducedMotion: string
    readonly host: string
    readonly superPower: string
    readonly disconnected: string
    readonly eliminated: string
    readonly me: string
    readonly shield: string
    readonly life: string
    readonly battery: string
    readonly cursedCard: string
  }

  readonly history: {
    readonly title: string
    readonly empty: string
    readonly started: string
    readonly skipped: string
    readonly attack: (from: string, to: string, cards: string) => string
    readonly superAttack: (from: string, to: string, cards: string) => string
    readonly damage: (amount: number) => string
    readonly blocked: string
    readonly shield: (from: string, to: string, value: number, self: boolean) => string
    readonly superShield: (from: string, to: string, value: number, self: boolean) => string
    readonly charge: (from: string, to: string, self: boolean) => string
    readonly resurrect: (from: string, to: string) => string
    readonly eliminated: (who: string) => string
    readonly won: (who: string) => string
  }

  readonly settings: {
    readonly title: string
    readonly language: string
    readonly sfx: string
    readonly music: string
    readonly reducedMotion: string
    readonly reducedMotionHint: string
  }

  readonly actions: Readonly<Record<ActionType, string>>

  /** Ce que chaque visage donne à entendre d'abord : sa coupe. */
  readonly avatars: Readonly<Record<AvatarId, string>>

  readonly events: {
    readonly gameStarted: string
    readonly drawn: (who: string, value: number) => string
    readonly attack: (
      from: string,
      to: string,
      raw: number,
      shield: number,
      dealt: number,
    ) => string
    readonly lifeDamaged: (who: string, from: number, to: number) => string
    readonly lifeDestroyed: (who: string) => string
    readonly shieldSet: (by: string, who: string, value: number) => string
    /** Sans la valeur : la charge est posée face cachée. */
    readonly batterySet: (by: string, who: string) => string
    readonly batteryLost: (who: string, reason: 'spent' | 'broken') => string
    readonly superUsed: (who: string) => string
    readonly resurrected: (by: string, who: string) => string
    readonly playerDied: (who: string) => string
    readonly turnChanged: (who: string) => string
    readonly gameWon: (who: string) => string
  }

  readonly rejections: Readonly<Record<RejectionCode, string>>
}
