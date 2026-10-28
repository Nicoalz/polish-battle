import type { GameState } from '@pb/engine'
import { useI18n } from './i18n'
import { TurnClock } from './TurnClock'
import { useStage } from './scene/stage'

/**
 * Ce que la table est en train de vivre.
 *
 * Deux horloges cohabitent : l'état autoritaire, sur lequel se calculent les coups
 * jouables, et l'affichage, en retard du temps que durent les animations. La bannière
 * lisait l'affichage et annonçait donc « au tour de X » alors que X avait déjà joué et
 * que son voisin pouvait agir — deux messages contradictoires à l'écran pendant près de
 * trois secondes.
 *
 * Elle raconte désormais le coup en cours tant qu'il se joue, et ne revient au tour
 * qu'une fois la table au repos. Plus rien ne se contredit : ce qui s'anime est décrit,
 * ce qui est jouable reste décidé par l'état autoritaire.
 *
 * Composant à part : la mise en scène le redessine plusieurs fois par action, et n'a
 * aucune raison d'entraîner la table avec elle.
 */
export function TurnBanner({ game, display }: { game: GameState; display: GameState }) {
  const t = useI18n((state) => state.t)
  const narration = useStage((state) => state.narration)

  const who = (id: string) => display.players.find((player) => player.id === id)?.name ?? '?'
  const current = display.players.find((player) => player.seat === display.turnSeat)
  const winner = display.players.find((player) => player.id === display.winnerId)

  return (
    // Sur écran étroit l'indicateur passe sur sa propre ligne plutôt que de comprimer
    // les deux autres blocs de l'en-tête.
    <p className="pointer-events-none order-last mx-auto w-full rounded-full bg-black/45 px-4 py-1.5 text-center text-xs backdrop-blur-sm sm:order-none sm:w-auto sm:text-sm">
      {narration
        ? t.table.narration[narration.kind](
            who(narration.byId),
            narration.toId === undefined ? undefined : who(narration.toId),
          )
        : null}

      {!narration && display.phase === 'lobby' && t.table.waiting}
      {!narration && display.phase === 'playing' && (
        <>
          {t.table.turnOf(current?.name ?? '?')}
          {/* Le décompte suit l'état autoritaire : c'est lui que le serveur chronomètre. */}
          <TurnClock turnSeat={game.turnSeat} playing={game.phase === 'playing'} />
        </>
      )}
      {!narration && display.phase === 'finished' && t.table.wins(winner?.name ?? '?')}
    </p>
  )
}
