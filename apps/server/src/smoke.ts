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
  EMOTE_COOLDOWN_MS,
  chooseAction,
  fromWire,
  isEmote,
  isHiddenCard,
  type Action,
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
  let spentCharges = 0
  let maskedOnSpend = 0
  /** Ce qu'un joueur donné n'aurait jamais dû pouvoir lire. */
  const leaks: string[] = []
  let sawReveal = false
  /** Réactions reçues par observateur : une réaction doit atteindre toute la table. */
  const reactions = new Map<string, number>()

  for (const [index, name] of ['Alice', 'Bob', 'Chloé'].entries()) {
    const room = await (index === 0
      ? client.joinOrCreate('game', { code: CODE, playerId: `p${index}`, name })
      : client.joinById(rooms[0]!.roomId, { code: CODE, playerId: `p${index}`, name }))
    const viewer = roomPlayerIds[index]!

    room.onMessage('events', (payload: any) => {
      for (const event of payload.events) {
        // On ne compte que sur un seul client : chaque diffusion arrive à toute la
        // table, compter partout multiplierait les totaux. C'est Bob qui compte, parce
        // qu'il est le seul à ne jamais quitter la partie.
        if (index === 1) eventCounts.set(event.t, (eventCounts.get(event.t) ?? 0) + 1)

        // Une carte jouée en attaque ou en bouclier se révèle à toute la table : c'est
        // au moment du coup, pas avant, et c'est voulu.
        if (event.t === 'drawn') {
          sawReveal = true
          if (isHiddenCard(event.card)) leaks.push('une carte jouée arrive masquée')
        }

        if (event.t === 'battery-set' && !isHiddenCard(event.card)) {
          leaks.push(`${viewer} voit la charge posée sur ${event.playerId}`)
        }

        // Une charge dépensée cesse d'être secrète : elle arrive à découvert dans
        // l'attaque. On le vérifie sur le masquage, et non sur sa valeur — la carte
        // maudite vaut zéro de plein droit, et l'exiger non nulle faisait échouer la
        // vérification une partie sur trois, au hasard de la graine.
        if (event.t === 'attack-resolved' && event.cards.length > 1) {
          spentCharges++
          if (isHiddenCard(event.cards[1])) maskedOnSpend++
        }
      }
    })

    room.onMessage('emote', (payload: any) => {
      if (!isEmote(payload?.emote)) leaks.push(`${viewer} reçoit une réaction inconnue`)
      reactions.set(viewer, (reactions.get(viewer) ?? 0) + 1)
    })

    room.onMessage('rejected', (payload: any) => rejections.push(payload.code))
    rooms.push(room)
  }

  /** Observatoire stable : Bob ne quitte jamais la partie. */
  const table = () => rooms[1]!
  /**
   * Les places sont redistribuées à chaque manche : on cherche un joueur par son
   * identité, jamais par sa position dans la liste.
   */
  const seen = (playerId: string) => snapshot(table()).players.find((p) => p.id === playerId)!
  const roomOf = (playerId: string) => rooms[roomPlayerIds.indexOf(playerId)]!

  console.log('\nSalon')
  await waitFor(() => snapshot(table()).players.length === 3, '3 joueurs au salon')
  const lobby = snapshot(table())
  check('les 3 joueurs rejoignent le même salon', lobby.players.length === 3)
  check('le premier arrivant est hôte', lobby.players[0]!.isHost === true)
  check('les suivants ne le sont pas', lobby.players.slice(1).every((p) => !p.isHost))
  check(
    'personne n’est servi avant le lancement',
    lobby.players.every((p) => p.life.length === 0),
  )

  console.log('\nRéactions de table')
  const reacted = (playerId: string) => reactions.get(playerId) ?? 0
  const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

  roomOf('p1').send('emote', { emote: '🔥' })
  // On attend les trois : n'attendre que le premier reviendrait à vérifier une course
  // entre trois sockets indépendantes, et à la gagner par chance.
  await waitFor(() => roomPlayerIds.every((id) => reacted(id) === 1), 'réaction reçue partout')
  check(
    'une réaction atteint toute la table',
    roomPlayerIds.every((id) => reacted(id) === 1),
    roomPlayerIds.map((id) => `${id}=${reacted(id)}`).join(' '),
  )

  roomOf('p1').send('emote', { emote: 'rm -rf /' })
  await pause(250)
  check('une réaction inconnue n’est pas relayée', reacted('p0') === 1)

  roomOf('p1').send('emote', { emote: '😂' })
  await pause(250)
  check('un joueur seul ne peut pas couvrir la table', reacted('p0') === 1)

  await pause(EMOTE_COOLDOWN_MS)
  roomOf('p1').send('emote', { emote: '😂' })
  await waitFor(() => reacted('p0') === 2, 'seconde réaction')
  check('… mais il réagit de nouveau passé le délai', reacted('p0') === 2)

  console.log('\nOptions de partie')
  /** Résumé d'une main : ses valeurs, sans ses identifiants, qui diffèrent toujours. */
  const hands = () =>
    snapshot(table()).players.map((p) => [...p.life.map((c) => c.value), p.shield.value].join('-'))

  check('elles partent par défaut éteintes', snapshot(table()).options.mirrorStart === false)

  roomOf('p0').send('options', { mirrorStart: true })
  await waitFor(() => snapshot(table()).options.mirrorStart, 'option reçue')
  check('l’hôte peut les changer', snapshot(table()).options.mirrorStart === true)

  const beforeOptions = rejections.length
  roomOf('p1').send('options', { mirrorStart: false })
  await new Promise((resolve) => setTimeout(resolve, 300))
  check(
    'un non-hôte ne peut pas les changer',
    rejections.length > beforeOptions && snapshot(table()).options.mirrorStart === true,
  )

  // L'option reste allumée : c'est au lancement qu'elle se vérifie, pas au salon, et
  // la suite de la partie se joue aussi bien à mains égales.

  console.log('\nAutorité du serveur')
  roomOf('p1').send('start')
  await new Promise((resolve) => setTimeout(resolve, 300))
  check(
    'un non-hôte ne peut pas lancer la partie',
    snapshot(table()).phase === 'lobby' && rejections.includes('host-only'),
    `phase=${snapshot(table()).phase}`,
  )

  roomOf('p0').send('start')
  await waitFor(() => snapshot(table()).phase === 'playing', 'partie démarrée')
  check("l'hôte peut lancer la partie", snapshot(table()).phase === 'playing')
  check(
    '… et le départ en miroir sert la même main à tout le monde',
    new Set(hands()).size === 1,
    hands().join(' / '),
  )

  const before = rejections.length
  const notMyTurn = snapshot(table()).turnSeat === 0 ? roomOf('p1') : roomOf('p0')
  notMyTurn.send('action', { type: 'draw' })
  await new Promise((resolve) => setTimeout(resolve, 300))
  check(
    'jouer hors de son tour est refusé',
    rejections.length > before,
    'aucun refus reçu',
  )

  console.log('\nReprise de siège')
  await roomOf('p2').leave(true)
  await waitFor(() => !seen('p2').connected, 'Chloé déconnectée')
  check('un départ marque le joueur déconnecté', !seen('p2').connected)
  check('son siège et ses cartes restent en place', snapshot(table()).players.length === 3)

  const chloeAgain = await client.joinById(table().roomId, {
    code: CODE,
    playerId: 'p2',
    name: 'Chloé',
  })
  chloeAgain.onMessage('events', () => {})
  chloeAgain.onMessage('rejected', (payload: any) => rejections.push(payload.code))
  rooms[2] = chloeAgain
  await waitFor(() => seen('p2').connected, 'Chloé revenue')
  check('elle retrouve sa place en se reconnectant', seen('p2').connected)

  console.log('\nRôle d’hôte')
  await roomOf('p0').leave(true)
  await waitFor(() => !seen('p0').connected, 'Alice déconnectée')
  await waitFor(
    () => snapshot(table()).players.some((player) => player.isHost && player.connected),
    'un hôte présent',
  )
  const newHost = snapshot(table()).players.find((player) => player.isHost)!
  check('le rôle passe à un joueur présent quand l’hôte s’absente', newHost.id !== 'p0')
  check('… et il n’y a jamais deux hôtes', snapshot(table()).players.filter((p) => p.isHost).length === 1)

  const aliceAgain = await client.joinById(table().roomId, {
    code: CODE,
    playerId: 'p0',
    name: 'Alice',
  })
  aliceAgain.onMessage('events', () => {})
  aliceAgain.onMessage('rejected', (payload: any) => rejections.push(payload.code))
  rooms[0] = aliceAgain
  await waitFor(() => seen('p0').connected, 'Alice revenue')
  check(
    'à son retour elle retrouve sa place, pas le rôle',
    snapshot(table()).players.find((player) => player.isHost)!.id === newHost.id,
  )

  console.log('\nPartie complète')

  /** Joue un tour, au choix de l'IA ou selon une consigne. */
  async function playTurn(forced?: (playerId: string, opponents: string[]) => Action) {
    const state = snapshot(table())

    // Au passage : une charge posée ne doit jamais être lisible dans l'état partagé.
    for (const seen of state.players) {
      if (!seen.battery) continue
      sawBattery = true
      if (!isHiddenCard(seen.battery)) leaks.push(`charge lisible dans l'état de ${seen.id}`)
    }

    const player = state.players.find((p) => p.seat === state.turnSeat)
    if (!player) return undefined

    const room = roomOf(player.id)
    const opponents = state.players
      .filter((other) => other.id !== player.id && other.life.some((card) => card.value > 0))
      .map((other) => other.id)

    const action = forced?.(player.id, opponents) ?? chooseAction(snapshot(room), player.id)
    if (!action) return undefined

    const before = (table().state as any).version
    room.send('action', action)
    await waitFor(
      () => (table().state as any).version !== before,
      `action ${action.type} de ${player.name}`,
    )
    return player.id
  }

  // Deux coups dictés plutôt que laissés au hasard : sans cela, la charge n'est exercée
  // que si l'IA décide d'en poser une, et le test réussit ou échoue selon la donne.
  const charger = await playTurn((playerId) => ({ type: 'charge', targetId: playerId }))
  let guard = 0
  while (snapshot(table()).phase === 'playing' && guard++ < 50) {
    const state = snapshot(table())
    if (state.players.find((p) => p.seat === state.turnSeat)?.id === charger) break
    await playTurn()
  }
  if (snapshot(table()).phase === 'playing') {
    await playTurn((playerId, opponents) => ({ type: 'attack', targetId: opponents[0] ?? playerId }))
  }

  guard = 0
  while (snapshot(table()).phase === 'playing' && guard++ < 400) {
    if (!(await playTurn())) break
  }

  const final = snapshot(table())
  check('la partie se termine', final.phase === 'finished', `phase=${final.phase}`)
  check('un vainqueur est désigné', Boolean(final.winnerId))
  check(
    'le vainqueur est le seul encore en vie',
    final.players.filter((p) => p.life.reduce((s, c) => s + c.value, 0) > 0).length === 1,
  )
  check('des événements ont été diffusés', (eventCounts.get('attack-resolved') ?? 0) > 0)
  check('une charge a bien été posée pendant la partie', sawBattery)
  check('les cartes jouées se révèlent à la table', sawReveal)
  check(
    'aucune carte secrète ne fuit, ni par l’état ni par les événements',
    leaks.length === 0,
    leaks.slice(0, 3).join(' ; '),
  )
  // Le compte figure dans l'intitulé, et pas seulement en cas d'échec : la partie est
  // tirée au sort, il arrive qu'aucune charge ne soit dépensée, et une vérification
  // qui passe sans rien avoir observé doit se voir à la lecture.
  check(
    `une charge dépensée arrive à découvert (${spentCharges} observée(s))`,
    maskedOnSpend === 0,
    `${maskedOnSpend} encore masquée(s)`,
  )
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
