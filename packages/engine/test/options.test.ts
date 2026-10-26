import { describe, expect, it } from 'vitest'
import {
  IllegalActionError,
  addPlayer,
  applyAction,
  createGame,
  setOptions,
  startGame,
} from '../src/rules'
import { DEFAULT_OPTIONS, toOptions } from '../src/options'
import { game, player } from './helpers'

const table = (seed: number, mirrorStart: boolean) => {
  let state = createGame(seed)
  state = setOptions(state, { mirrorStart })
  for (const id of ['a', 'b', 'c', 'd']) state = addPlayer(state, { id, name: id })
  return state
}

const hands = (state: ReturnType<typeof table>) =>
  state.players.map((p) => [...p.life.map((c) => c.value), p.shield.value].join('-'))

describe('la lecture d’un réglage venu du réseau', () => {
  it('ignore ce qu’elle ne connaît pas', () => {
    expect(toOptions({ mirrorStart: true, triche: true })).toEqual({ mirrorStart: true })
  })

  it('ramène tout à un booléen', () => {
    // Sans cela, un client malicieux glisserait n'importe quoi dans l'état de jeu.
    expect(toOptions({ mirrorStart: 'oui' })).toEqual({ mirrorStart: false })
    expect(toOptions(undefined)).toEqual(DEFAULT_OPTIONS)
    expect(toOptions('n’importe quoi')).toEqual(DEFAULT_OPTIONS)
  })
})

describe('le départ en miroir (option « même départ pour tous »)', () => {
  it('sert la même main à tout le monde', () => {
    for (let seed = 0; seed < 40; seed++) {
      const started = startGame(table(seed, true)).state
      expect(new Set(hands(started)).size).toBe(1)
    }
  })

  it('laisse les mains différer quand l’option est éteinte', () => {
    // Sur quarante tables de quatre joueurs, des mains toutes identiques seraient
    // impossibles autrement que par l'option.
    const identical = Array.from({ length: 40 }, (_, seed) => startGame(table(seed, false)).state)
      .filter((state) => new Set(hands(state)).size === 1)
    expect(identical.length).toBe(0)
  })

  it('donne à chacun ses propres cartes, malgré des valeurs communes', () => {
    const started = startGame(table(7, true)).state
    const ids = started.players.flatMap((p) => [...p.life.map((c) => c.id), p.shield.id])
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('n’entame pas la vie des autres quand une carte est touchée', () => {
    // C'est ce que coûterait un identifiant partagé : les dégâts désignent leur carte
    // par identifiant, et une main recopiée telle quelle serait une main commune.
    const started = startGame(table(3, true)).state
    const attacker = started.players.find((p) => p.seat === started.turnSeat)!
    const victim = started.players.find((p) => p.id !== attacker.id)!
    const spared = started.players.filter((p) => p.id !== victim.id)
    const before = spared.map((p) => p.life.map((c) => c.value))

    const { state: after } = applyAction(started, attacker.id, {
      type: 'attack',
      targetId: victim.id,
    })

    expect(spared.map((p) => after.players.find((q) => q.id === p.id)!.life.map((c) => c.value)))
      .toEqual(before)
  })

  it('se règle dans n’importe quel ordre', () => {
    // Personne n'est servi au salon : cocher l'option avant ou après l'arrivée des
    // joueurs revient au même, puisque la donne n'a lieu qu'au lancement.
    let late = createGame(11)
    for (const id of ['a', 'b', 'c', 'd']) late = addPlayer(late, { id, name: id })
    late = setOptions(late, { mirrorStart: true })

    expect(hands(startGame(late).state)).toEqual(hands(startGame(table(11, true)).state))
  })
})

describe('le verrou des options', () => {
  it('refuse de changer les règles en pleine partie', () => {
    const playing = game([player('a', 0), player('b', 1)])
    expect(() => setOptions(playing, { mirrorStart: true })).toThrow(IllegalActionError)
  })

  it('les laisse se régler une fois la partie finie', () => {
    const finished = game([player('a', 0), player('b', 1)], { phase: 'finished' })
    expect(setOptions(finished, { mirrorStart: true }).options.mirrorStart).toBe(true)
  })

  it('ne touche pas aux mains déjà jouées sur l’écran de victoire', () => {
    const finished = game([player('a', 0), player('b', 1)], { phase: 'finished' })
    const after = setOptions(finished, { mirrorStart: true })
    expect(after.players.map((p) => p.life.map((c) => c.id))).toEqual(
      finished.players.map((p) => p.life.map((c) => c.id)),
    )
  })
})
