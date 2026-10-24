import { describe, expect, it } from 'vitest'
import { MAX_VALUE, drawCard, drawCards, drawLifeCards, isCursed, isDamaged, totalValue } from '../src/cards'
import { createGame } from '../src/rules'

describe('la carte maudite (GAME_RULES §2)', () => {
  it('se reconnaît à son rang nul', () => {
    expect(isCursed({ rank: 0 })).toBe(true)
    expect(isCursed({ rank: 13 })).toBe(false)
    expect(isCursed({ rank: 1 })).toBe(false)
  })

  it('sort avec une valeur nulle', () => {
    const state = createGame(1)
    let found = false
    for (let i = 0; i < 5000 && !found; i++) {
      const drawn = drawCard(state)
      if (isCursed(drawn)) {
        expect(drawn.value).toBe(0)
        found = true
      }
    }
    expect(found).toBe(true)
  })
})

describe('la distribution des valeurs (héritée du paquet de 52)', () => {
  /**
   * L'habillage a changé, pas l'équilibre : les fréquences doivent rester celles du
   * tirage d'origine, où la carte maudite était le roi de cœur et où les trois autres
   * rois se partageaient la valeur 13.
   */
  it('respecte les fréquences du tirage d’origine', () => {
    const draws = 520_000
    const counts = new Map<number, number>()
    const state = createGame(2026)
    for (let i = 0; i < draws; i++) {
      const value = drawCard(state).value
      counts.set(value, (counts.get(value) ?? 0) + 1)
    }

    const expected = (outcomes: number) => (draws * outcomes) / 52
    const tolerance = draws * 0.004

    expect(Math.abs((counts.get(0) ?? 0) - expected(1))).toBeLessThan(tolerance)
    expect(Math.abs((counts.get(13) ?? 0) - expected(3))).toBeLessThan(tolerance)
    for (let value = 1; value <= 12; value++) {
      expect(Math.abs((counts.get(value) ?? 0) - expected(4))).toBeLessThan(tolerance)
    }
  })

  it('ne produit aucune valeur hors bornes', () => {
    const state = createGame(5)
    for (let i = 0; i < 20_000; i++) {
      const value = drawCard(state).value
      expect(value).toBeGreaterThanOrEqual(0)
      expect(value).toBeLessThanOrEqual(MAX_VALUE)
    }
  })
})

describe('le tirage (GAME_RULES §2)', () => {
  it('est déterministe à graine égale', () => {
    expect(drawCards(createGame(42), 20)).toEqual(drawCards(createGame(42), 20))
  })

  it('diffère à graine différente', () => {
    const a = drawCards(createGame(42), 20).map((c) => c.value)
    const b = drawCards(createGame(43), 20).map((c) => c.value)
    expect(a).not.toEqual(b)
  })

  it('donne à chaque carte un identifiant unique', () => {
    const cards = drawCards(createGame(7), 500)
    expect(new Set(cards.map((c) => c.id)).size).toBe(500)
  })

  it('sort une carte intacte : rang et valeur confondus', () => {
    for (const card of drawCards(createGame(11), 200)) {
      expect(card.value).toBe(card.rank)
      expect(isDamaged(card)).toBe(false)
    }
  })
})

describe('la distribution des cartes de vie (correction du bug n°3)', () => {
  it('ne sert jamais une main de vie nulle', () => {
    for (let seed = 0; seed < 3000; seed++) {
      const state = createGame(seed)
      expect(totalValue(drawLifeCards(state, 2))).toBeGreaterThan(0)
      expect(totalValue(drawLifeCards(state, 1))).toBeGreaterThan(0)
    }
  })

  it('la garde est bien nécessaire : un tirage brut peut valoir 0', () => {
    const state = createGame(3)
    let zeroes = 0
    for (let i = 0; i < 5000; i++) {
      if (drawCard(state).value === 0) zeroes++
    }
    expect(zeroes).toBeGreaterThan(0)
  })
})
