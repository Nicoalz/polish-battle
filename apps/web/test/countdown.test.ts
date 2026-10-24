import { describe, expect, it } from 'vitest'
import { overlaps, stepTowards } from '../src/scene/countdown'
import type { Card } from '@pb/engine'

const card = (id: string, value: number): Card => ({ id, rank: Math.max(value, 1), value })

describe('la descente des cartes de vie', () => {
  it('retire un point par pas', () => {
    const shown = [card('a', 7)]
    const next = stepTowards(shown, [card('a', 3)])
    expect(next.map((c) => c.value)).toEqual([6])
  })

  it('en retire deux au-delà d’un gros écart, pour ne pas s’éterniser', () => {
    const next = stepTowards([card('a', 13)], [card('a', 0)])
    expect(next.map((c) => c.value)).toEqual([11])
  })

  it('garde une carte détruite le temps qu’elle s’éteigne', () => {
    // Elle a disparu de la cible, mais vaut encore 2 : sa place reste occupée.
    const next = stepTowards([card('a', 2), card('b', 5)], [card('b', 5)])
    expect(next.map((c) => `${c.id}:${c.value}`)).toEqual(['a:1', 'b:5'])
  })

  it('… puis la retire une fois à zéro', () => {
    const next = stepTowards([card('a', 0), card('b', 5)], [card('b', 5)])
    expect(next.map((c) => c.id)).toEqual(['b'])
  })

  it('fait apparaître une carte nouvelle sans attendre', () => {
    const next = stepTowards([card('a', 4)], [card('a', 4), card('b', 9)])
    expect(next.map((c) => `${c.id}:${c.value}`)).toEqual(['a:4', 'b:9'])
  })

  it('ne touche à rien quand l’affichage est à jour', () => {
    const shown = [card('a', 4)]
    // Même référence : c'est ce qui arrête la boucle d'animation.
    expect(stepTowards(shown, [card('a', 4)])).toBe(shown)
  })

  it('descend jusqu’à la cible, sans la dépasser', () => {
    let shown = [card('a', 9), card('b', 6)]
    const target = [card('b', 2)]
    for (let step = 0; step < 50; step++) shown = stepTowards(shown, target)
    expect(shown.map((c) => `${c.id}:${c.value}`)).toEqual(['b:2'])
  })

  it('reconnaît une donne entièrement nouvelle', () => {
    expect(overlaps([card('a', 4)], [card('z', 7)])).toBe(false)
    expect(overlaps([card('a', 4)], [card('a', 2)])).toBe(true)
    expect(overlaps([], [card('a', 2)])).toBe(true)
  })
})
