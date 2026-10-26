import type { GameOptions } from './types'

/**
 * Options de partie.
 *
 * Elles se règlent au salon et ne bougent plus une fois la partie lancée. Le catalogue
 * vit ici, et non dans l'interface, parce que le serveur doit valider ce qu'un client
 * envoie : un message arbitraire ne doit pas pouvoir inventer une option.
 *
 * Ajouter une option, c'est une entrée dans `GameOptions`, une valeur par défaut, et une
 * traduction — que le typage réclame avant de compiler.
 */

export const DEFAULT_OPTIONS: GameOptions = {
  mirrorStart: false,
}

export const OPTION_KEYS = Object.keys(DEFAULT_OPTIONS) as OptionKey[]

export type OptionKey = keyof GameOptions

export function isOptionKey(value: string): value is OptionKey {
  return value in DEFAULT_OPTIONS
}

/**
 * Relit un réglage venu du réseau.
 *
 * Les clés inconnues sont ignorées et les valeurs ramenées à des booléens : l'état de
 * jeu ne contient jamais autre chose que ce que le moteur sait lire.
 */
export function toOptions(raw: unknown): GameOptions {
  const options = { ...DEFAULT_OPTIONS }
  if (typeof raw !== 'object' || raw === null) return options

  for (const [key, value] of Object.entries(raw)) {
    if (isOptionKey(key)) options[key] = value === true
  }
  return options
}
