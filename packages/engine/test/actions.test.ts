import { describe, expect, it } from 'vitest'
import { IllegalActionError, applyAction, legalActions } from '../src/rules'
import { card, duel, duelDrawing, game, player } from './helpers'

describe('les actions légales (GAME_RULES §4)', () => {
  it('sont vides hors de son tour', () => {
    expect(legalActions(duel(), 'b')).toEqual([])
  })

  it('sont vides tant que la partie n’a pas commencé', () => {
    const state = game([player('a', 0), player('b', 1)], { phase: 'lobby' })
    expect(legalActions(state, 'a')).toEqual([])
  })

  it('proposent les trois coups de carte et les deux super-pouvoirs', () => {
    const types = new Set(legalActions(duel(), 'a').map((a) => a.type))
    expect(types).toEqual(new Set(['attack', 'shield', 'charge', 'super-attack', 'super-shield']))
  })

  it('n’offrent plus de piocher : la carte se tire en jouant', () => {
    expect(legalActions(duel(), 'a').some((a) => (a.type as string) === 'draw')).toBe(false)
  })

  it('ne dépendent d’aucune carte : le coup se choisit à l’aveugle', () => {
    // Deux tables identiques, deux aléas différents : la liste doit être la même.
    const first = legalActions(duelDrawing(1), 'a')
    const second = legalActions(duelDrawing(13), 'a')
    expect(first).toEqual(second)
  })

  it('se limitent aux coups de carte quand le super-pouvoir est déjà dépensé', () => {
    const types = new Set(legalActions(duel({ hasSuperPower: false }), 'a').map((a) => a.type))
    expect(types).toEqual(new Set(['attack', 'shield', 'charge']))
  })

  it('rejettent toute action absente de la liste', () => {
    expect(() => applyAction(duel(), 'b', { type: 'attack', targetId: 'a' })).toThrow(
      IllegalActionError,
    )
    expect(() => applyAction(duel(), 'a', { type: 'resurrect', targetId: 'b' })).toThrow(
      IllegalActionError,
    )
  })
})

describe('la charge (GAME_RULES §5)', () => {
  it('ne propose pas une cible qui porte déjà une charge', () => {
    const targets = legalActions(duel({}, { battery: card(4) }), 'a')
      .filter((a) => a.type === 'charge')
      .map((a) => (a.type === 'charge' ? a.targetId : ''))

    expect(targets).toEqual(['a'])
  })

  it('refuse la charge sur une cible déjà chargée', () => {
    expect(() =>
      applyAction(duel({}, { battery: card(4) }), 'a', { type: 'charge', targetId: 'b' }),
    ).toThrow(IllegalActionError)
  })

  it('pose la carte tirée sans jamais la révéler', () => {
    const { state: next, events } = applyAction(duelDrawing(9), 'a', {
      type: 'charge',
      targetId: 'b',
    })

    expect(next.players[1]!.battery?.value).toBe(9)
    // Aucune révélation : c'est ce qui rend la charge secrète jusqu'à sa dépense.
    expect(events.some((e) => e.t === 'drawn')).toBe(false)
    expect(next.turnSeat).toBe(1)
  })
})

describe('les coups de carte (GAME_RULES §5)', () => {
  it('révèlent la carte au moment de la jouer, puis passent la main', () => {
    const { state: next, events } = applyAction(duelDrawing(11), 'a', {
      type: 'shield',
      targetId: 'b',
    })

    expect(events.map((e) => e.t)).toEqual(['drawn', 'shield-set', 'turn-changed'])
    expect(next.players[1]!.shield.value).toBe(11)
    expect(next.turnSeat).toBe(1)
  })

  it('changer un bouclier est un pari : la carte peut renforcer la cible', () => {
    const state = duelDrawing(13, {}, { shield: card(2) })
    const { state: next } = applyAction(state, 'a', { type: 'shield', targetId: 'b' })

    expect(next.players[1]!.shield.value).toBe(13)
  })

  it('… comme elle peut l’affaiblir', () => {
    const state = duelDrawing(1, {}, { shield: card(13) })
    const { state: next } = applyAction(state, 'a', { type: 'shield', targetId: 'b' })

    expect(next.players[1]!.shield.value).toBe(1)
  })

  it('laisse se protéger soi-même', () => {
    const state = duelDrawing(12, { shield: card(1) })
    const { state: next } = applyAction(state, 'a', { type: 'shield', targetId: 'a' })

    expect(next.players[0]!.shield.value).toBe(12)
  })
})
