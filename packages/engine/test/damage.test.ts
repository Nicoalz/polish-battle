import { describe, expect, it } from 'vitest'
import { applyAction } from '../src/rules'
import { card, cursed, drawing, duelDrawing, lifeValues, player, game } from './helpers'

describe('le calcul des dégâts (GAME_RULES §5 et §6)', () => {
  it('inflige carte + batterie − bouclier', () => {
    const state = duelDrawing(7, { battery: card(4) }, { shield: card(3), life: [card(13), card(13)] })
    const { state: next, events } = applyAction(state, 'a', { type: 'attack', targetId: 'b' })

    const resolved = events.find((e) => e.t === 'attack-resolved')
    expect(resolved).toMatchObject({ raw: 11, shieldValue: 3, dealt: 8 })
    expect(lifeValues(next, 'b')).toEqual([5, 13])
  })

  it('ne fait rien quand le bouclier est supérieur ou égal à l’attaque', () => {
    const state = duelDrawing(5, {}, { shield: card(9), life: [card(10)] })
    const { state: next, events } = applyAction(state, 'a', { type: 'attack', targetId: 'b' })

    expect(events.find((e) => e.t === 'attack-resolved')).toMatchObject({ dealt: 0 })
    expect(events.some((e) => e.t === 'life-damaged' || e.t === 'life-destroyed')).toBe(false)
    expect(lifeValues(next, 'b')).toEqual([10])
  })

  it('entame la carte de vie la plus ancienne en premier', () => {
    const state = duelDrawing(4, {}, { life: [card(10), card(2)] })
    const { state: next, events } = applyAction(state, 'a', { type: 'attack', targetId: 'b' })

    expect(lifeValues(next, 'b')).toEqual([6, 2])
    expect(events.find((e) => e.t === 'life-damaged')).toMatchObject({ from: 10, to: 6 })
  })

  it('déborde sur la carte suivante quand la première est détruite', () => {
    const state = duelDrawing(13, {}, { life: [card(5), card(10)] })
    const { state: next, events } = applyAction(state, 'a', { type: 'attack', targetId: 'b' })

    expect(lifeValues(next, 'b')).toEqual([2])
    expect(events.filter((e) => e.t === 'life-destroyed')).toHaveLength(1)
    expect(events.find((e) => e.t === 'life-damaged')).toMatchObject({ from: 10, to: 2 })
  })

  it('perd le surplus de dégâts au lieu de le reporter ailleurs', () => {
    const state = drawing(
      13,
      game([
        player('a', 0, { battery: card(13) }),
        player('b', 1, { life: [card(2)] }),
        player('c', 2, { life: [card(9)] }),
      ]),
    )
    const { state: next } = applyAction(state, 'a', { type: 'attack', targetId: 'b' })

    expect(lifeValues(next, 'b')).toEqual([])
    expect(lifeValues(next, 'c')).toEqual([9])
  })

  it('détruit gratuitement une carte de vie maudite', () => {
    const state = duelDrawing(1, {}, { life: [cursed(), card(8)] })
    const { state: next } = applyAction(state, 'a', { type: 'attack', targetId: 'b' })

    // La carte maudite n'absorbe rien : elle saute, et le point de dégât passe derrière.
    expect(lifeValues(next, 'b')).toEqual([7])
  })
})

describe('la charge de la cible (GAME_RULES §6)', () => {
  it('saute quand une carte de vie est détruite', () => {
    const state = duelDrawing(9, {}, { life: [card(5), card(5)], battery: card(6) })
    const { state: next, events } = applyAction(state, 'a', { type: 'attack', targetId: 'b' })

    expect(next.players[1]!.battery).toBeUndefined()
    expect(events.some((e) => e.t === 'battery-lost' && e.playerId === 'b')).toBe(true)
  })

  it('saute aussi sur un coup encaissé sans destruction', () => {
    // Encaisser suffit : il n'est pas nécessaire d'y laisser une carte de vie.
    const state = duelDrawing(3, {}, { life: [card(10)], battery: card(6) })
    const { state: next, events } = applyAction(state, 'a', { type: 'attack', targetId: 'b' })

    expect(next.players[1]!.battery).toBeUndefined()
    expect(events.some((e) => e.t === 'battery-lost' && e.playerId === 'b')).toBe(true)
    expect(next.players[1]!.life[0]!.value).toBe(7)
  })

  it('survit à une attaque entièrement arrêtée par le bouclier', () => {
    // Rien n'est passé : il n'y a pas eu de dégâts, donc pas de charge perdue.
    const state = duelDrawing(4, {}, { shield: card(10), battery: card(6) })
    const { state: next, events } = applyAction(state, 'a', { type: 'attack', targetId: 'b' })

    expect(next.players[1]!.battery?.value).toBe(6)
    expect(events.some((e) => e.t === 'battery-lost' && e.playerId === 'b')).toBe(false)
  })
})

describe('la batterie de l’attaquant (GAME_RULES §5)', () => {
  it('est consommée par l’attaque, même sans dégâts', () => {
    const state = duelDrawing(2, { battery: card(3) }, { shield: card(13) })
    const { state: next, events } = applyAction(state, 'a', { type: 'attack', targetId: 'b' })

    expect(next.players[0]!.battery).toBeUndefined()
    expect(events.some((e) => e.t === 'battery-lost' && e.playerId === 'a' && e.reason === 'spent')).toBe(true)
  })

  it('part avec la carte jouée dans l’événement d’attaque', () => {
    const state = duelDrawing(7, { battery: card(4) })
    const { events } = applyAction(state, 'a', { type: 'attack', targetId: 'b' })

    const resolved = events.find((e) => e.t === 'attack-resolved')!
    expect(resolved.t === 'attack-resolved' && resolved.cards.map((c) => c.value)).toEqual([7, 4])
  })
})
