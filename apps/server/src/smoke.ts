/**
 * Test d'intégration bout en bout, sans navigateur.
 *
 * Démarre un vrai serveur, y connecte plusieurs clients, joue une partie complète
 * pilotée par l'IA du moteur, et vérifie au passage que la triche est refusée et
 * qu'un joueur peut reprendre son siège. C'est la validation de la phase 2 : le
 * gameplay tourne en réseau avant qu'on écrive la moindre ligne de 3D.
 *
 *   pnpm --filter @pb/server smoke
 */
import { createServer } from 'node:http'
import process from 'node:process'
import { Server } from '@colyseus/core'
import { WebSocketTransport } from '@colyseus/ws-transport'
import { Client, type Room } from 'colyseus.js'
import {
  chooseAction,
  fromWire,
  isHiddenCard,
  type Card,
  type GameState,
  type WireGame,
} from '@pb/engine'
import { GameRoom } from './GameRoom'

// Port attribué par le système : un port fixe entrerait en conflit avec un serveur
// de développement déjà lancé, et ferait échouer `pnpm verify` sans rapport avec le jeu.
const CODE = 'SMOKE'

let failures = 0
function check(label: string, condition: boolean, detail = ''): void {
  if (condition) {
    console.log(`  ✓ ${label}`)
  } else {
    failures++
    console.log(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`)
  }
}

/** Replace la pioche privée dans l'état, comme le fait le vrai client. */
function withHand(state: GameState, playerId: string, hand: Card | undefined): GameState {
  const mine = state.players.find((player) => player.id === playerId)
  if (hand && mine?.drawn) mine.drawn = hand
  return state
}

function snapshot(room: Room): GameState {
  return fromWire((room.state as unknown as { toJSON(): WireGame }).toJSON())
}

async function waitFor(
  predicate: () => boolean,
  label: string,
  timeoutMs = 5000,
): Promise<void> {
  const deadline = Date.now() + timeoutMs
  while (!predicate()) {
    if (Date.now() > deadline) throw new Error(`délai dépassé : ${label}`)
    await new Promise((resolve) => setTimeout(resolve, 20))
  }
}

async function main(): Promise<void> {
  const httpServer = createServer()
  const gameServer = new Server({ transport: new WebSocketTransport({ server: httpServer }) })
  gameServer.define('game', GameRoom).filterBy(['code'])
  await gameServer.listen(0)

  const address = httpServer.address()
  const port = typeof address === 'object' && address ? address.port : 0
  const client = new Client(`ws://localhost:${port}`)
  const rooms: Room[] = []
  const roomPlayerIds = ['p0', 'p1', 'p2']
  const eventCounts = new Map<string, number>()
  const rejections: string[] = []
  let sawBattery = false
  let revealedOnAttack = false
  /** Ce qu'un joueur donné n'aurait jamais dû pouvoir lire. */
  const leaks: string[] = []
  let sawOwnDraw = false
  let sawOthersDraw = false
  /** La pioche privée de chaque joueur, telle que le vrai client la reçoit. */
  const hands: (Card | undefined)[] = []

  for (const [index, name] of ['Alice', 'Bob', 'Chloé'].entries()) {
    const room = await (index === 0
      ? client.joinOrCreate('game', { code: CODE, playerId: `p${index}`, name })
      : client.joinById(rooms[0]!.roomId, { code: CODE, playerId: `p${index}`, name }))
    const viewer = roomPlayerIds[index]!

    room.onMessage('events', (payload: any) => {
      for (const event of payload.events) {
        // On ne compte que sur un seul client : chaque diffusion arrive à toute la
        // table, compter partout multiplierait les totaux par le nombre de joueurs.
        if (index === 0) eventCounts.set(event.t, (eventCounts.get(event.t) ?? 0) + 1)

        if (event.t === 'drawn') {
          if (event.playerId === viewer) {
            sawOwnDraw = true
            if (isHiddenCard(event.card)) leaks.push('sa propre pioche lui est cachée')
          } else {
            sawOthersDraw = true
            if (!isHiddenCard(event.card)) {
              leaks.push(`${viewer} voit la pioche de ${event.playerId}`)
            }
          }
        }

        if (event.t === 'battery-set' && !isHiddenCard(event.card)) {
          leaks.push(`${viewer} voit la charge posée sur ${event.playerId}`)
        }

        if (event.t === 'attack-resolved' && event.cards.length > 1) {
          if (event.cards[1].value > 0) revealedOnAttack = true
        }
      }
    })

    // Canal privé : ma pioche, et elle seule. Le vrai client la replace dans son état
    // avant de décider quoi jouer ; le test fait de même, sans quoi l'IA jouerait à
    // l'aveugle sur une carte masquée.
    room.onMessage('hand', (card: Card | null) => {
      if (card && isHiddenCard(card)) leaks.push('la carte privée arrive masquée')
      hands[index] = card ?? undefined
    })
    room.onMessage('rejected', (payload: any) => rejections.push(payload.code))
    rooms.push(room)
  }

  const [alice, bob, chloe] = rooms as [Room, Room, Room]

  console.log('\nSalon')
  await waitFor(() => snapshot(alice).players.length === 3, '3 joueurs au salon')
  const lobby = snapshot(alice)
  check('les 3 joueurs rejoignent le même salon', lobby.players.length === 3)
  check('le premier arrivant est hôte', lobby.players[0]!.isHost === true)
  check('les suivants ne le sont pas', lobby.players.slice(1).every((p) => !p.isHost))
  check('les cartes sont bien reçues', lobby.players[0]!.life.length === 2)

  console.log('\nAutorité du serveur')
  bob.send('start')
  await new Promise((resolve) => setTimeout(resolve, 300))
  check(
    'un non-hôte ne peut pas lancer la partie',
    snapshot(alice).phase === 'lobby' && rejections.includes('host-only'),
    `phase=${snapshot(alice).phase}`,
  )

  alice.send('start')
  await waitFor(() => snapshot(alice).phase === 'playing', 'partie démarrée')
  check("l'hôte peut lancer la partie", snapshot(alice).phase === 'playing')

  const before = rejections.length
  const notMyTurn = snapshot(alice).turnSeat === 0 ? bob : alice
  notMyTurn.send('action', { type: 'draw' })
  await new Promise((resolve) => setTimeout(resolve, 300))
  check(
    'jouer hors de son tour est refusé',
    rejections.length > before,
    'aucun refus reçu',
  )

  console.log('\nReprise de siège')
  await chloe.leave(true)
  await waitFor(() => snapshot(alice).players[2]!.connected === false, 'Chloé déconnectée')
  check('un départ marque le joueur déconnecté', !snapshot(alice).players[2]!.connected)
  check('son siège et ses cartes restent en place', snapshot(alice).players.length === 3)

  const chloeAgain = await client.joinById(alice.roomId, {
    code: CODE,
    playerId: 'p2',
    name: 'Chloé',
  })
  chloeAgain.onMessage('events', () => {})
  chloeAgain.onMessage('rejected', (payload: any) => rejections.push(payload.code))
  rooms[2] = chloeAgain
  await waitFor(() => snapshot(alice).players[2]!.connected === true, 'Chloé revenue')
  check('elle retrouve sa place en se reconnectant', snapshot(alice).players[2]!.connected)

  console.log('\nPartie complète')
  let guard = 0
  while (snapshot(alice).phase === 'playing' && guard++ < 400) {
    const state = snapshot(alice)
    const player = state.players.find((p) => p.seat === state.turnSeat)
    if (!player) break

    const index = roomPlayerIds.indexOf(player.id)
    const room = rooms[index]
    // Chacun décide depuis sa propre vue, pioche privée replacée.
    const own = room ? withHand(snapshot(room), player.id, hands[index]) : state
    const action = chooseAction(own, player.id)
    if (!room || !action) break
    for (const [index, seen] of state.players.entries()) {
      if (seen.battery) {
        sawBattery = true
        if (!isHiddenCard(seen.battery)) leaks.push(`charge lisible dans l'état de ${seen.id}`)
      }
      // Dans l'état partagé, seule ma propre pioche m'est révélée — et encore, par un
      // autre canal : celle du schéma est masquée pour tout le monde.
      if (seen.drawn && !isHiddenCard(seen.drawn) && index !== 0) {
        leaks.push(`pioche de ${seen.id} lisible dans l'état partagé`)
      }
    }

    const versionBefore = (alice.state as any).version
    room.send('action', action)
    await waitFor(
      () => (alice.state as any).version !== versionBefore,
      `action ${action.type} de ${player.name}`,
    )
  }

  const final = snapshot(alice)
  check('la partie se termine', final.phase === 'finished', `phase=${final.phase}`)
  check('un vainqueur est désigné', Boolean(final.winnerId))
  check(
    'le vainqueur est le seul encore en vie',
    final.players.filter((p) => p.life.reduce((s, c) => s + c.value, 0) > 0).length === 1,
  )
  check('des événements ont été diffusés', (eventCounts.get('attack-resolved') ?? 0) > 0)
  check('une charge a bien été posée pendant la partie', sawBattery)
  check('chacun reçoit sa propre pioche', sawOwnDraw)
  check('chacun voit les autres piocher', sawOthersDraw)
  check(
    'aucune carte secrète ne fuit, ni par l’état ni par les événements',
    leaks.length === 0,
    leaks.slice(0, 3).join(' ; '),
  )
  check('une charge dépensée se révèle dans l’attaque', revealedOnAttack)
  check('un changement de tour a été diffusé', (eventCounts.get('turn-changed') ?? 0) > 0)
  check('la victoire a été diffusée', (eventCounts.get('game-won') ?? 0) === 1)

  console.log('\nÉvénements observés :')
  for (const [type, count] of [...eventCounts].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${String(count).padStart(4)} × ${type}`)
  }

  for (const room of rooms) await room.leave(true)
  await gameServer.gracefullyShutdown(false)

  console.log(failures === 0 ? '\n✓ Tout passe.\n' : `\n✗ ${failures} vérification(s) en échec.\n`)
  process.exit(failures === 0 ? 0 : 1)
}

main().catch((error) => {
  console.error('\nÉchec du test de fumée :', error)
  process.exit(1)
})
