import { describe, expect, it } from 'vitest'
import { EMOTES, isEmote } from '../src/emotes'

describe('les réactions de table', () => {
  it('reconnaît celles de la liste', () => {
    for (const emote of EMOTES) expect(isEmote(emote)).toBe(true)
  })

  it('refuse tout le reste', () => {
    // C'est le seul point d'arrêt : sans lui, le message d'un client deviendrait du
    // texte libre affiché sur la table de tout le monde.
    expect(isEmote('bonjour')).toBe(false)
    expect(isEmote('🦄')).toBe(false)
    expect(isEmote('')).toBe(false)
    expect(isEmote(undefined)).toBe(false)
    expect(isEmote(3)).toBe(false)
  })

  it('n’en propose jamais deux fois la même', () => {
    expect(new Set(EMOTES).size).toBe(EMOTES.length)
  })
})
