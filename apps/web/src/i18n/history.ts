import type { GameEvent, GameState } from '@pb/engine'
import type { Dict, RejectionCode } from './types'

/**
 * Résume une action entière en une phrase.
 *
 * Le serveur diffuse le détail de ce qui s'est passé — carte dévoilée, dégâts, cartes
 * détruites, charge perdue — mais l'historique n'a pas à le réciter : un joueur qui
 * revient en arrière veut relire des coups, pas des événements. Un lot d'événements
 * correspondant exactement à une action, il devient exactement une ligne.
 */
export function describeAction(
  events: GameEvent[],
  t: Dict,
  game: GameState | undefined,
): string {
  const who = (id: string) => game?.players.find((player) => player.id === id)?.name ?? id
  const h = t.history

  const attack = events.find((event) => event.t === 'attack-resolved')
  const shield = events.find((event) => event.t === 'shield-set')
  const charge = events.find((event) => event.t === 'battery-set')
  const revived = events.find((event) => event.t === 'resurrected')
  const won = events.find((event) => event.t === 'game-won')
  const deaths = events.filter((event) => event.t === 'player-died')

  let line: string

  if (attack) {
    // « 7 + 4 » quand une charge est dépensée : c'est l'addition qu'on vient de voir.
    const cards = attack.cards.map((card) => card.value).join(' + ')
    line =
      attack.kind === 'super'
        ? h.superAttack(who(attack.fromId), who(attack.toId), cards)
        : h.attack(who(attack.fromId), who(attack.toId), cards)
    line += attack.dealt > 0 ? h.damage(attack.dealt) : h.blocked
  } else if (shield) {
    const self = shield.byId === shield.playerId
    const value = shield.card.value
    line =
      shield.kind === 'super'
        ? h.superShield(who(shield.byId), who(shield.playerId), value, self)
        : h.shield(who(shield.byId), who(shield.playerId), value, self)
  } else if (charge) {
    line = h.charge(who(charge.byId), who(charge.playerId), charge.byId === charge.playerId)
  } else if (revived) {
    line = h.resurrect(who(revived.byId), who(revived.playerId))
  } else if (events.some((event) => event.t === 'game-started')) {
    return h.started
  } else {
    return h.skipped
  }

  for (const death of deaths) line += h.eliminated(who(death.playerId))
  if (won) line += h.won(who(won.playerId))

  return line
}

export function describeRejection(code: RejectionCode, t: Dict): string {
  return `⛔ ${t.rejections[code] ?? code}`
}
