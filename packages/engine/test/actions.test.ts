import { describe, expect, it } from 'vitest'
import { IllegalActionError, applyAction, legalActions } from '../src/rules'
import { card, duel, game, player } from './helpers'

describe('les actions légales (GAME_RULES §4)', () => {
  it('sont vides hors de son tour', () => {
    expect(legalActions(duel(), 'b')).toEqual([])
  })

  it('sont vides tant que la partie n’a pas commencé', () => {
    const state = game([player('a', 0), player('b', 1)], { phase: 'lobby' })
    expect(legalActions(state, 'a')).toEqual([])
  })

  it('se limitent à piocher et aux super-pouvoirs avant la pioche', () => {
    const types = new Set(legalActions(duel(), 'a').map((a) => a.type))
    expect(types).toEqual(new Set(['draw', 'super-attack', 'super-shield']))
  })

  it('se limitent aux trois actions de carte après la pioche', () => {
    const types = new Set(legalActions(duel({ drawn: card(5) }), 'a').map((a) => a.type))
    expect(types).toEqual(new Set(['attack', 'shield', 'charge']))
  })

  it('n’autorisent plus de piocher une deuxième fois', () => {
    const state = duel({ drawn: card(5) })
    expect(legalActions(state, 'a').some((a) => a.type === 'draw')).toBe(false)
  })

  it('ferment les super-pouvoirs dès qu’une carte est piochée', () => {
    const state = duel({ drawn: card(5), hasSuperPower: true })
    expect(legalActions(state, 'a').some((a) => a.type.startsWith('super'))).toBe(false)
  })

  it('rejettent toute action absente de la liste', () => {
    expect(() => applyAction(duel(), 'a', { type: 'attack', targetId: 'b' })).toThrow(
      IllegalActionError,
    )
    expect(() => applyAction(duel({ drawn: card(5) }), 'b', { type: 'attack', targetId: 'a' })).toThrow(
      IllegalActionError,
    )
  })
})

describe('la charge (GAME_RULES §5, correction du blocage de tour)', () => {
  it('ne propose pas une cible qui porte déjà une batterie', () => {
    const state = duel({ drawn: card(9) }, { battery: card(4) })
    const targets = legalActions(state, 'a')
      .filter((a) => a.type === 'charge')
      .map((a) => (a.type === 'charge' ? a.targetId : ''))

    expect(targets).toEqual(['a'])
  })

  it('refuse la charge sur une cible déjà chargée', () => {
    const state = duel({ drawn: card(9) }, { battery: card(4) })
    expect(() => applyAction(state, 'a', { type: 'charge', targetId: 'b' })).toThrow(
      IllegalActionError,
    )
  })

  it('reste possible sur n’importe quel joueur vivant non chargé', () => {
    const state = duel({ drawn: card(9) })
    const { state: next } = applyAction(state, 'a', { type: 'charge', targetId: 'b' })

    expect(next.players[1]!.battery?.value).toBe(9)
    expect(next.turnSeat).toBe(1)
  })
})

describe('les actions de carte (GAME_RULES §5)', () => {
  it('piocher ne termine pas le tour', () => {
    const { state: next, events } = applyAction(duel(), 'a', { type: 'draw' })

    expect(next.turnSeat).toBe(0)
    expect(next.players[0]!.drawn).toBeDefined()
    expect(events.map((e) => e.t)).toEqual(['drawn'])
  })

  it('changer un bouclier remplace celui de la cible et passe la main', () => {
    const state = duel({ drawn: card(11) }, { shield: card(2) })
    const { state: next } = applyAction(state, 'a', { type: 'shield', targetId: 'b' })

    expect(next.players[1]!.shield.value).toBe(11)
    expect(next.players[0]!.drawn).toBeUndefined()
    expect(next.turnSeat).toBe(1)
  })

  it('permet de saboter en posant un petit bouclier sur un adversaire', () => {
    const state = duel({ drawn: card(1) }, { shield: card(13) })
    const { state: next } = applyAction(state, 'a', { type: 'shield', targetId: 'b' })

    expect(next.players[1]!.shield.value).toBe(1)
  })

  it('laisse se protéger soi-même', () => {
    const state = duel({ drawn: card(12), shield: card(1) })
    const { state: next } = applyAction(state, 'a', { type: 'shield', targetId: 'a' })

    expect(next.players[0]!.shield.value).toBe(12)
  })
})
