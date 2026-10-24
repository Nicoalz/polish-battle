import { hiddenCard, isAlive, type Card, type GameState, type PlayerState } from '@pb/engine'
import { CardSchema, GameSchema, PlayerSchema } from './schema'

/**
 * Recopie l'état du moteur dans le schéma synchronisé.
 *
 * On écrit champ par champ, et seulement quand la valeur a changé : Colyseus marque
 * chaque affectation comme modifiée, donc une recopie aveugle enverrait l'état entier
 * à chaque action — exactement ce qu'on reproche à la v1.
 */

function writeCard(node: CardSchema, card: Card): void {
  if (node.id !== card.id) node.id = card.id
  if (node.rank !== card.rank) node.rank = card.rank
  if (node.value !== card.value) node.value = card.value
}

function makeCard(card: Card): CardSchema {
  const node = new CardSchema()
  writeCard(node, card)
  return node
}

/**
 * Pose ou retire une carte facultative (batterie, carte piochée).
 *
 * `@colyseus/schema` v3 type les références comme obligatoires alors que l'exécution
 * accepte `undefined` — elle encode alors une suppression. D'où la conversion, isolée
 * ici plutôt que dispersée dans le fichier.
 */
function assignOptionalCard(
  owner: PlayerSchema,
  field: 'battery' | 'drawn',
  card: Card | undefined,
): void {
  const current = owner[field] as CardSchema | undefined
  if (!card) {
    if (current) owner[field] = undefined as unknown as CardSchema
    return
  }
  if (current) writeCard(current, card)
  else owner[field] = makeCard(card)
}

function syncCards(list: CardSchema[], cards: Card[]): void {
  while (list.length > cards.length) list.pop()
  cards.forEach((card, index) => {
    const existing = list[index]
    if (existing) writeCard(existing, card)
    else list.push(makeCard(card))
  })
}

function hide(slot: 'drawn' | 'battery', card: Card | undefined, playerId: string) {
  return card ? hiddenCard(slot, playerId) : undefined
}

function syncPlayer(node: PlayerSchema, player: PlayerState): void {
  if (node.id !== player.id) node.id = player.id
  if (node.name !== player.name) node.name = player.name
  if (node.seat !== player.seat) node.seat = player.seat
  if (node.hasSuperPower !== player.hasSuperPower) node.hasSuperPower = player.hasSuperPower
  if (node.connected !== player.connected) node.connected = player.connected
  if (node.isHost !== player.isHost) node.isHost = player.isHost

  const alive = isAlive(player)
  if (node.alive !== alive) node.alive = alive

  syncCards(node.life, player.life)

  const shield = node.shield as CardSchema | undefined
  if (shield) writeCard(shield, player.shield)
  else node.shield = makeCard(player.shield)

  // Ni la charge ni la carte piochée ne circulent en clair dans l'état partagé.
  // La pioche est privée — son propriétaire la reçoit par un message qui n'est adressé
  // qu'à lui — et la charge reste cachée de tous, y compris de son porteur, puisque
  // c'est ainsi qu'elle est montrée. L'une comme l'autre se révèlent d'elles-mêmes au
  // moment d'être jouées : l'attaque et le bouclier transportent la carte entière.
  assignOptionalCard(node, 'battery', hide('battery', player.battery, player.id))
  assignOptionalCard(node, 'drawn', hide('drawn', player.drawn, player.id))
}

export function syncState(target: GameSchema, source: GameState): void {
  if (target.phase !== source.phase) target.phase = source.phase
  if (target.turnSeat !== source.turnSeat) target.turnSeat = source.turnSeat

  const winnerId = source.winnerId ?? ''
  if (target.winnerId !== winnerId) target.winnerId = winnerId

  // Les joueurs n'arrivent et ne partent qu'au salon ; en partie, seul leur contenu bouge.
  const sameRoster =
    target.players.length === source.players.length &&
    source.players.every((player, index) => target.players[index]?.id === player.id)

  if (!sameRoster) {
    target.players.splice(0, target.players.length)
    for (const player of source.players) {
      const node = new PlayerSchema()
      syncPlayer(node, player)
      target.players.push(node)
    }
    return
  }

  source.players.forEach((player, index) => {
    const node = target.players[index]
    if (node) syncPlayer(node, player)
  })
}
