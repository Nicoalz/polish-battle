import { useMemo, useState } from 'react'
import { isStanding, legalActions, type Action, type ActionType, type GameState } from '@pb/engine'
import { useGame } from '../net/store'
import { useI18n } from '../i18n'
import { describeAction, describeRejection } from '../i18n/history'
import { LocaleSwitch } from '../i18n/LocaleSwitch'
import { CardView } from './Card'

/**
 * Interface de debug : volontairement moche.
 *
 * Elle sert à valider les règles en vraies parties avant d'investir dans la 3D, et
 * restera disponible ensuite comme outil de développement.
 */
export function DebugTable({ game }: { game: GameState }) {
  const { playerId, code, log, send, command, kick, leave } = useGame()
  const t = useI18n((state) => state.t)
  const [showLog, setShowLog] = useState(true)

  const me = game.players.find((player) => player.id === playerId)
  const actions = useMemo(() => legalActions(game, playerId), [game, playerId])
  const byType = useMemo(() => groupByType(actions), [actions])
  const current = game.players.find((player) => player.seat === game.turnSeat)
  const winner = game.players.find((player) => player.id === game.winnerId)

  return (
    <div className="mx-auto max-w-5xl p-4">
      <header className="mb-4 flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-bold">{t.app.title}</h1>
        <span className="rounded bg-white/10 px-2 py-1 font-mono text-sm">{code}</span>
        <span className="text-sm text-slate-400">
          {game.phase === 'lobby' && t.table.waiting}
          {game.phase === 'playing' && t.table.turnOf(current?.name ?? '?')}
          {game.phase === 'finished' && t.table.wins(winner?.name ?? '?')}
        </span>
        <LocaleSwitch className="ml-auto" />
        <button className="text-sm text-slate-400 underline" onClick={() => void leave()}>
          {t.table.leave}
        </button>
      </header>

      {me?.isHost && (
        <div className="mb-4 flex flex-wrap gap-2">
          {game.phase === 'lobby' && (
            <button className={BTN} onClick={() => command('start')} disabled={game.players.length < 2}>
              {t.table.start}
            </button>
          )}
          {game.phase !== 'lobby' && (
            <button className={BTN} onClick={() => command('restart')}>
              {t.table.restart}
            </button>
          )}
          {game.phase === 'playing' && (
            <button className={BTN_GHOST} onClick={() => command('skip')}>
              {t.table.skipTurn}
            </button>
          )}
        </div>
      )}

      <ul className="mb-6 grid gap-2 sm:grid-cols-2">
        {game.players.map((player) => {
          const alive = isStanding(player)
          const isTurn = player.seat === game.turnSeat && game.phase === 'playing'
          return (
            <li
              key={player.id}
              className={`rounded-lg border p-3 ${
                isTurn ? 'border-emerald-400/60 bg-emerald-400/5' : 'border-white/10 bg-white/5'
              } ${alive ? '' : 'opacity-40'}`}
            >
              <div className="mb-2 flex items-center gap-2 text-sm">
                <span className="font-semibold">{player.name}</span>
                {player.isHost && <span title={t.table.host}>👑</span>}
                {player.hasSuperPower && <span title={t.table.superPower}>💥</span>}
                {!player.connected && <span className="text-amber-400">{t.table.disconnected}</span>}
                {!alive && <span className="text-rose-400">{t.table.eliminated}</span>}
                {player.id === playerId && <span className="text-slate-400">{t.table.me}</span>}
                {me?.isHost && player.id !== playerId && game.phase === 'lobby' && (
                  <button className="ml-auto text-xs text-slate-500 underline" onClick={() => kick(player.id)}>
                    {t.table.kick}
                  </button>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-1 text-xs text-slate-400">
                <span className="w-16">{t.table.shield}</span>
                <CardView card={player.shield} role="shield" />
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-1 text-xs text-slate-400">
                <span className="w-16">{t.table.life}</span>
                {player.life.length === 0 && <span className="text-rose-400">—</span>}
                {player.life.map((card) => (
                  <CardView key={card.id} card={card} role="life" />
                ))}
              </div>
              {player.battery && (
                <div className="mt-1 flex items-center gap-1 text-xs text-slate-400">
                  <span className="w-16">{t.table.battery}</span>
                  <CardView card={player.battery} role="battery" />
                </div>
              )}
            </li>
          )
        })}
      </ul>

      {actions.length > 0 && (
        <section className="mb-6 rounded-lg border border-white/10 bg-white/5 p-3">
          <h2 className="mb-2 text-sm font-semibold">{t.table.yourTurn}</h2>
          <div className="flex flex-col gap-2">
            {[...byType.entries()].map(([type, list]) => (
              <div key={type} className="flex flex-wrap items-center gap-2">
                <span className="w-44 shrink-0 text-sm text-slate-400">{t.actions[type]}</span>
                {list.map((action) => {
                    const targetId = 'targetId' in action ? action.targetId : ''
                    const target = game.players.find((player) => player.id === targetId)
                  return (
                    <button key={targetId} className={BTN_GHOST} onClick={() => send(action)}>
                      {target?.name ?? targetId}
                      {targetId === playerId ? ` ${t.table.me}` : ''}
                    </button>
                  )
                })}
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="rounded-lg border border-white/10 bg-black/30">
        <button
          className="w-full px-3 py-2 text-left text-sm text-slate-400"
          onClick={() => setShowLog((value) => !value)}
        >
          {t.table.log} {showLog ? '▾' : '▸'}
        </button>
        {showLog && (
          <ol className="max-h-72 overflow-auto px-3 pb-3 font-mono text-xs text-slate-400">
            {log.map((entry) => (
              <li key={entry.id} className="whitespace-pre-wrap">
                {entry.kind === 'action'
                  ? describeAction(entry.events, t, game)
                  : describeRejection(entry.code, t)}
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  )
}

function groupByType(actions: Action[]): Map<ActionType, Action[]> {
  const grouped = new Map<ActionType, Action[]>()
  for (const action of actions) {
    const list = grouped.get(action.type)
    if (list) list.push(action)
    else grouped.set(action.type, [action])
  }
  return grouped
}

const BTN =
  'rounded bg-emerald-500 px-3 py-1.5 text-sm font-semibold text-slate-900 hover:bg-emerald-400 disabled:opacity-40'
const BTN_GHOST =
  'rounded border border-white/20 px-3 py-1.5 text-sm hover:border-white/50 hover:bg-white/5'
