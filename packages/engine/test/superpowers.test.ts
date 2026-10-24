import { describe, expect, it } from 'vitest'
import { IllegalActionError, SUPER_POWER_FLOOR, applyAction, legalActions } from '../src/rules'
import { isCursed } from '../src/cards'
import { card, duel, game, player } from './helpers'

describe('la super-attaque (GAME_RULES §7)', () => {
  it('frappe au minimum à 8', () => {
    for (let seed = 0; seed < 200; seed++) {
      const state = duel({}, { shield: card(0), life: [card(13), card(13)] })
      state.rng = seed
      const { events } = applyAction(state, 'a', { type: 'super-attack', targetId: 'b' })
      const resolved = events.find((e) => e.t === 'attack-resolved')!
      expect(resolved.t === 'attack-resolved' && resolved.raw).toBeGreaterThanOrEqual(
        SUPER_POWER_FLOOR,
      )
    }
  })

  it('ajoute la batterie de l’attaquant et la consomme (correction v2)', () => {
    const state = duel({ battery: card(5) }, { life: [card(13), card(13)] })
    const { state: next, events } = applyAction(state, 'a', { type: 'super-attack', targetId: 'b' })

    const resolved = events.find((e) => e.t === 'attack-resolved')!
    expect(resolved.t === 'attack-resolved' && resolved.raw).toBeGreaterThanOrEqual(13)
    expect(next.players[0]!.battery).toBeUndefined()
    expect(
      events.some((e) => e.t === 'battery-lost' && e.playerId === 'a' && e.reason === 'spent'),
    ).toBe(true)
  })

  it('vide la batterie de la cible même sans détruire de carte de vie', () => {
    const state = duel({}, { shield: card(13), battery: card(7), life: [card(13)] })
    const { state: next } = applyAction(state, 'a', { type: 'super-attack', targetId: 'b' })

    expect(next.players[1]!.battery).toBeUndefined()
    expect(next.players[1]!.life[0]!.value).toBe(13) // rien n'est passé, mais la batterie saute
  })

  it('ne produit jamais une carte marquée maudite', () => {
    // Une super-carte tirée sur la carte maudite doit voir son rang relevé avec sa
    // valeur, sinon l'interface la dessine en carte maudite alors qu'elle vaut 8.
    for (let seed = 0; seed < 400; seed++) {
      const state = duel()
      state.rng = seed
      const { state: next } = applyAction(state, 'a', { type: 'super-shield', targetId: 'a' })
      const shield = next.players[0]!.shield
      expect(isCursed(shield)).toBe(false)
      expect(shield.value).toBeGreaterThanOrEqual(SUPER_POWER_FLOOR)
    }
  })

  it('consomme le super-pouvoir', () => {
    const { state: next } = applyAction(duel(), 'a', { type: 'super-attack', targetId: 'b' })
    expect(next.players[0]!.hasSuperPower).toBe(false)
  })
})

describe('le super-bouclier (GAME_RULES §7)', () => {
  it('installe un bouclier d’au moins 8', () => {
    for (let seed = 0; seed < 200; seed++) {
      const state = duel({ shield: card(1) })
      state.rng = seed
      const { state: next } = applyAction(state, 'a', { type: 'super-shield', targetId: 'a' })
      expect(next.players[0]!.shield.value).toBeGreaterThanOrEqual(SUPER_POWER_FLOOR)
    }
  })

  it('peut être offert à un autre joueur', () => {
    const state = duel({}, { shield: card(1) })
    const { state: next } = applyAction(state, 'a', { type: 'super-shield', targetId: 'b' })

    expect(next.players[1]!.shield.value).toBeGreaterThanOrEqual(SUPER_POWER_FLOOR)
    expect(next.players[0]!.hasSuperPower).toBe(false)
  })
})

describe('la résurrection (GAME_RULES §7)', () => {
  const table = () =>
    game([
      player('a', 0),
      player('b', 1),
      player('c', 2, { life: [], hasSuperPower: true }),
    ])

  it('n’est proposée que sur un joueur mort', () => {
    const targets = legalActions(table(), 'a')
      .filter((a) => a.type === 'resurrect')
      .map((a) => (a.type === 'resurrect' ? a.targetId : ''))

    expect(targets).toEqual(['c'])
  })

  it('rend une carte de vie non nulle et un bouclier neuf', () => {
    const { state: next, events } = applyAction(table(), 'a', { type: 'resurrect', targetId: 'c' })
    const revived = next.players[2]!

    expect(revived.life).toHaveLength(1)
    expect(revived.life[0]!.value).toBeGreaterThan(0)
    expect(revived.shield).toBeDefined()
    expect(events.some((e) => e.t === 'resurrected' && e.playerId === 'c')).toBe(true)
    expect(events.some((e) => e.t === 'player-died')).toBe(false)
  })

  it('coûte le super-pouvoir du lanceur et celui du ressuscité', () => {
    const { state: next } = applyAction(table(), 'a', { type: 'resurrect', targetId: 'c' })

    expect(next.players[0]!.hasSuperPower).toBe(false)
    expect(next.players[2]!.hasSuperPower).toBe(false)
  })

  it('remet le ressuscité dans l’ordre du tour', () => {
    const { state: next } = applyAction(table(), 'a', { type: 'resurrect', targetId: 'c' })
    expect(next.phase).toBe('playing')
    expect(next.turnSeat).toBe(1)
  })
})

describe('le super-pouvoir est unique (GAME_RULES §7)', () => {
  it('disparaît après usage', () => {
    const state = duel({ hasSuperPower: false })
    expect(legalActions(state, 'a').some((a) => a.type.startsWith('super'))).toBe(false)
    expect(() => applyAction(state, 'a', { type: 'super-attack', targetId: 'b' })).toThrow(
      IllegalActionError,
    )
  })
})
