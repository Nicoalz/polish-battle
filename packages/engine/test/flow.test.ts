import { describe, expect, it } from 'vitest'
import {
  IllegalActionError,
  MAX_PLAYERS,
  addPlayer,
  isAlive,
  isDealt,
  isStanding,
  applyAction,
  createGame,
  legalActions,
  removePlayer,
  skipTurn,
  startGame,
} from '../src/rules'
import { card, drawing, duel, duelDrawing, game, player } from './helpers'

describe('l’ordre du tour (GAME_RULES §4)', () => {
  it('passe au joueur suivant', () => {
    const state = game([player('a', 0), player('b', 1), player('c', 2)])
    const { state: next } = applyAction(state, 'a', { type: 'shield', targetId: 'a' })
    expect(next.turnSeat).toBe(1)
  })

  it('saute les joueurs morts', () => {
    const state = game([
      player('a', 0),
      player('b', 1, { life: [] }),
      player('c', 2),
    ])
    const { state: next, events } = applyAction(state, 'a', { type: 'shield', targetId: 'a' })

    expect(next.turnSeat).toBe(2)
    expect(events.some((e) => e.t === 'turn-changed' && e.playerId === 'c')).toBe(true)
  })

  it('reboucle sur le premier siège vivant', () => {
    const state = game(
      [player('a', 0), player('b', 1), player('c', 2)],
      { turnSeat: 2 },
    )
    const { state: next } = applyAction(state, 'c', { type: 'shield', targetId: 'c' })
    expect(next.turnSeat).toBe(0)
  })
})

describe('la fin de partie (GAME_RULES §8)', () => {
  const killingBlow = () =>
    drawing(13, game([
      player('a', 0, { battery: card(13) }),
      player('b', 1, { life: [card(3)] }),
    ]))

  it('désigne un vainqueur dès qu’il ne reste qu’un survivant', () => {
    const { state: next, events } = applyAction(killingBlow(), 'a', {
      type: 'attack',
      targetId: 'b',
    })

    expect(next.phase).toBe('finished')
    expect(next.winnerId).toBe('a')
    expect(events.some((e) => e.t === 'player-died' && e.playerId === 'b')).toBe(true)
    expect(events.some((e) => e.t === 'game-won' && e.playerId === 'a')).toBe(true)
  })

  it('ne change plus de tour une fois la partie finie', () => {
    const { state: next, events } = applyAction(killingBlow(), 'a', {
      type: 'attack',
      targetId: 'b',
    })

    expect(events.some((e) => e.t === 'turn-changed')).toBe(false)
    expect(legalActions(next, 'a')).toEqual([])
  })

  it('verrouille la partie : plus aucune action n’est acceptée', () => {
    const { state: next } = applyAction(killingBlow(), 'a', { type: 'attack', targetId: 'b' })
    expect(() => applyAction(next, 'a', { type: 'attack', targetId: 'a' })).toThrow(
      IllegalActionError,
    )
  })

  it('ne boucle pas à l’infini si plus personne n’est vivant', () => {
    // La v1 partait en boucle infinie dans ce cas (bug n°14).
    const state = drawing(
      13,
      game([player('a', 0, { life: [card(1)] }), player('b', 1, { life: [card(1)] })]),
    )
    const { state: next } = applyAction(state, 'a', { type: 'attack', targetId: 'a' })

    expect(next.phase).toBe('finished')
    expect(next.winnerId).toBe('b')
  })
})

describe('le salon et la mise en place (GAME_RULES §3)', () => {
  it('fait du premier arrivant l’hôte', () => {
    let state = createGame(1)
    state = addPlayer(state, { id: 'a', name: 'Alice' })
    state = addPlayer(state, { id: 'b', name: 'Bob' })

    expect(state.players.map((p) => p.isHost)).toEqual([true, false])
    expect(state.players.map((p) => p.seat)).toEqual([0, 1])
  })

  it('ignore une arrivée en double (reprise de siège)', () => {
    let state = createGame(1)
    state = addPlayer(state, { id: 'a', name: 'Alice' })
    state = addPlayer(state, { id: 'a', name: 'Alice' })

    expect(state.players).toHaveLength(1)
  })

  it('refuse au-delà de la table pleine', () => {
    let state = createGame(1)
    for (let i = 0; i < MAX_PLAYERS; i++) {
      state = addPlayer(state, { id: `p${i}`, name: `J${i}` })
    }
    expect(() => addPlayer(state, { id: 'x', name: 'X' })).toThrow(IllegalActionError)
  })

  it('redonne la main à un siège vivant quand le joueur courant s’en va', () => {
    // Les sièges sont renumérotés au départ d'un joueur : sans recalage, `turnSeat`
    // désignerait quelqu'un d'autre, voire un siège mort.
    const state = game([player('a', 0), player('b', 1), player('c', 2)], { turnSeat: 1 })
    const next = removePlayer(state, 'b')

    expect(next.players.map((p) => p.id)).toEqual(['a', 'c'])
    expect(next.players.map((p) => p.seat)).toEqual([0, 1])
    const current = next.players.find((p) => p.seat === next.turnSeat)
    expect(current?.id).toBe('c')
  })

  it('saute les morts au moment de recaler le tour', () => {
    const state = game(
      [player('a', 0, { life: [] }), player('b', 1), player('c', 2)],
      { turnSeat: 2 },
    )
    const next = removePlayer(state, 'c')
    const current = next.players.find((p) => p.seat === next.turnSeat)

    expect(current?.id).toBe('b')
  })

  it('transmet le rôle d’hôte quand l’hôte s’en va', () => {
    let state = createGame(1)
    state = addPlayer(state, { id: 'a', name: 'Alice' })
    state = addPlayer(state, { id: 'b', name: 'Bob' })
    state = removePlayer(state, 'a')

    expect(state.players[0]).toMatchObject({ id: 'b', isHost: true, seat: 0 })
  })

  it('ne tient pas pour éliminé un joueur pas encore servi', () => {
    // Sans cette nuance, toute la table serait barrée au salon — et un arrivant
    // d'entre deux manches naîtrait mort.
    let state = createGame(1)
    state = addPlayer(state, { id: 'a', name: 'Alice' })
    const waiting = state.players[0]!

    expect(isDealt(waiting)).toBe(false)
    expect(isAlive(waiting)).toBe(false)
    expect(isStanding(waiting)).toBe(true)
  })

  it('sert l’arrivant d’entre deux manches à la manche suivante', () => {
    let state = createGame(1)
    for (const id of ['a', 'b']) state = addPlayer(state, { id, name: id })
    state = startGame(state).state
    state = { ...state, phase: 'finished' }
    state = addPlayer(state, { id: 'c', name: 'c' })

    expect(isDealt(state.players[2]!)).toBe(false)
    expect(state.players.every((p) => isDealt(p))).toBe(false)
    expect(startGame(state).state.players.every((p) => isDealt(p) && isAlive(p))).toBe(true)
  })

  it('ne sert personne avant le lancement', () => {
    // Rien n'est tiré au salon : tout serait resservi au démarrage, et la graine
    // avancerait sur des cartes que personne ne joue.
    const state = createGame(1)
    const after = addPlayer(state, { id: 'a', name: 'Alice' })

    expect(after.cardSeq).toBe(state.cardSeq)
    expect(after.rng).toBe(state.rng)
    expect(after.players[0]!.life).toEqual([])
  })

  it('recale le tour sur un siège valide quand un joueur quitte le salon', () => {
    // Personne n'étant « vivant » au salon, le repli du recalage pouvait renvoyer -1 —
    // et un siège négatif ne passe pas l'encodage réseau.
    let state = createGame(1)
    for (const id of ['a', 'b']) state = addPlayer(state, { id, name: id })
    const after = removePlayer(state, 'a')

    expect(after.turnSeat).toBe(0)
  })

  it('sert deux cartes de vie, un bouclier et un super-pouvoir à chacun', () => {
    let state = createGame(5)
    state = addPlayer(state, { id: 'a', name: 'Alice' })
    state = addPlayer(state, { id: 'b', name: 'Bob' })
    const { state: started, events } = startGame(state)

    for (const p of started.players) {
      expect(p.life).toHaveLength(2)
      expect(p.life.reduce((s, c) => s + c.value, 0)).toBeGreaterThan(0)
      expect(p.shield).toBeDefined()
      expect(p.hasSuperPower).toBe(true)
      expect(p.battery).toBeUndefined()
    }
    expect(started.phase).toBe('playing')
    expect(events.map((e) => e.t)).toEqual(['game-started', 'turn-changed'])
  })

  it('refuse de démarrer à moins de deux joueurs', () => {
    let state = createGame(1)
    state = addPlayer(state, { id: 'a', name: 'Alice' })
    expect(() => startGame(state)).toThrow(IllegalActionError)
  })

  it('resert tout le monde à neuf au redémarrage', () => {
    const finished = game([player('a', 0, { hasSuperPower: false, life: [] }), player('b', 1)], {
      phase: 'finished',
      winnerId: 'b',
    })
    const { state: restarted } = startGame(finished)

    expect(restarted.phase).toBe('playing')
    expect(restarted.winnerId).toBeUndefined()
    expect(restarted.players[0]!.hasSuperPower).toBe(true)
    expect(restarted.players[0]!.life).toHaveLength(2)
  })
})

describe('les places', () => {
  const table = (seed: number) => {
    let state = createGame(seed)
    for (const id of ['a', 'b', 'c', 'd']) state = addPlayer(state, { id, name: id })
    return startGame(state).state
  }

  it('changent d’une manche à l’autre', () => {
    const arrangements = new Set<string>()
    for (let seed = 0; seed < 60; seed++) {
      arrangements.add(table(seed).players.map((p) => p.id).join(''))
    }
    expect(arrangements.size).toBeGreaterThan(1)
  })

  it('gardent tout le monde, une fois chacun, et numérotées dans l’ordre', () => {
    for (let seed = 0; seed < 60; seed++) {
      const players = table(seed).players
      expect([...players].map((p) => p.id).sort()).toEqual(['a', 'b', 'c', 'd'])
      expect(players.map((p) => p.seat)).toEqual([0, 1, 2, 3])
    }
  })

  it('ne déplacent pas le rôle d’hôte', () => {
    // L'hôte est une propriété du joueur, pas de la chaise : il la garde en changeant de place.
    for (let seed = 0; seed < 60; seed++) {
      const hosts = table(seed).players.filter((p) => p.isHost)
      expect(hosts).toHaveLength(1)
      expect(hosts[0]!.id).toBe('a')
    }
  })

  it('restent reproductibles à graine égale', () => {
    expect(table(42).players.map((p) => p.id)).toEqual(table(42).players.map((p) => p.id))
  })
})

describe('le siège de départ', () => {
  const table = (seed: number) => {
    let state = createGame(seed)
    for (const id of ['a', 'b', 'c', 'd']) state = addPlayer(state, { id, name: id })
    return startGame(state).state
  }

  it('est tiré au sort, pour ne pas pénaliser le premier arrivé', () => {
    const seats = new Set<number>()
    for (let seed = 0; seed < 200; seed++) seats.add(table(seed).turnSeat)
    expect(seats.size).toBeGreaterThan(1)
  })

  it('reste un siège valide', () => {
    for (let seed = 0; seed < 200; seed++) {
      const state = table(seed)
      expect(state.turnSeat).toBeGreaterThanOrEqual(0)
      expect(state.turnSeat).toBeLessThan(state.players.length)
    }
  })

  it('est annoncé par l’événement de changement de tour', () => {
    let state = createGame(7)
    for (const id of ['a', 'b', 'c']) state = addPlayer(state, { id, name: id })
    const { state: started, events } = startGame(state)
    const turn = events.find((e) => e.t === 'turn-changed')

    expect(turn).toMatchObject({ seat: started.turnSeat })
  })

  it('reste reproductible à graine égale', () => {
    expect(table(42).turnSeat).toBe(table(42).turnSeat)
  })
})

describe('le passage de tour forcé (joueur absent, pouvoir d’hôte)', () => {
  it('passe la main et jette la carte piochée', () => {
    const { state: next } = skipTurn(duel())
    expect(next.turnSeat).toBe(1)
  })

  it('nomme celui qui perd son tour, pas celui qui en hérite', () => {
    const { events } = skipTurn(duel())

    // Deux joueurs distincts : le client doit pouvoir annoncer le bon sans avoir à
    // remonter dans un état d'affichage qui a toujours un tour de retard.
    expect(events).toContainEqual({ t: 'turn-skipped', playerId: 'a' })
    expect(events.some((e) => e.t === 'turn-changed' && e.playerId === 'b')).toBe(true)
  })

  it('ne raconte rien hors partie', () => {
    const lobby = addPlayer(addPlayer(createGame(1), { id: 'a', name: 'a' }), {
      id: 'b',
      name: 'b',
    })
    expect(skipTurn(lobby).events).toEqual([])
  })
})

describe('l’immutabilité du moteur', () => {
  it('ne modifie jamais l’état qu’on lui passe', () => {
    const state = duelDrawing(7, {}, { life: [card(9)] })
    const snapshot = structuredClone(state)
    applyAction(state, 'a', { type: 'attack', targetId: 'b' })

    expect(state).toEqual(snapshot)
  })
})
