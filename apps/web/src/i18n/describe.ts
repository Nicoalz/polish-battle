import type { GameEvent, GameState } from '@pb/engine'
import type { Dict, RejectionCode } from './types'

/**
 * Met un événement du moteur en mots, dans la langue courante.
 *
 * La mise en forme a lieu à l'affichage et non à la réception : changer de langue
 * retraduit donc tout le journal, y compris les lignes déjà passées.
 */
export function describeEvent(event: GameEvent, t: Dict, game: GameState | undefined): string {
  const who = (id: string) => game?.players.find((player) => player.id === id)?.name ?? id
  const e = t.events

  switch (event.t) {
    case 'game-started':
      return e.gameStarted
    case 'drawn':
      return e.drawn(who(event.playerId), event.card.value)
    case 'attack-resolved':
      return e.attack(
        who(event.fromId),
        who(event.toId),
        event.raw,
        event.shieldValue,
        event.dealt,
      )
    case 'life-damaged':
      return e.lifeDamaged(who(event.playerId), event.from, event.to)
    case 'life-destroyed':
      return e.lifeDestroyed(who(event.playerId))
    case 'shield-set':
      return e.shieldSet(who(event.byId), who(event.playerId), event.card.value)
    case 'battery-set':
      return e.batterySet(who(event.byId), who(event.playerId))
    case 'battery-lost':
      return e.batteryLost(who(event.playerId), event.reason)
    case 'super-used':
      return e.superUsed(who(event.playerId))
    case 'resurrected':
      return e.resurrected(who(event.byId), who(event.playerId))
    case 'player-died':
      return e.playerDied(who(event.playerId))
    case 'turn-changed':
      return e.turnChanged(who(event.playerId))
    case 'game-won':
      return e.gameWon(who(event.playerId))
  }
}

export function describeRejection(code: RejectionCode, t: Dict): string {
  return `⛔ ${t.rejections[code] ?? code}`
}
