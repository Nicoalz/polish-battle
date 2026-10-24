import { useEffect, useMemo, useState } from 'react'
import { legalActions, type ActionType, type GameState } from '@pb/engine'
import { useGame } from './net/store'
import { useI18n } from './i18n'
import { describeEvent, describeRejection } from './i18n/describe'
import { SettingsMenu } from './SettingsMenu'
import { useIsCompact } from './useViewport'
import { GameScene } from './scene/GameScene'
import { Nameplate } from './Nameplate'
import { seatColor } from './scene/seats'
import { useDirector } from './scene/director'
import { useStage } from './scene/stage'
import { isAlive } from '@pb/engine'

/** Ordre d'affichage des actions : les courantes d'abord, les super-pouvoirs ensuite. */
const ACTION_ORDER: ActionType[] = [
  'attack',
  'shield',
  'charge',
  'super-attack',
  'super-shield',
  'resurrect',
]

/**
 * @param game    état autoritaire — ce qu'il est permis de jouer, maintenant
 * @param display état affiché — en retard du temps que durent les animations
 *
 * Les deux ne peuvent pas être confondus : calculer les actions sur l'affichage
 * laisserait les boutons actifs pendant toute l'animation, et l'interface proposerait
 * des coups que le serveur vient de consommer.
 */
export function GameView({ game, display }: { game: GameState; display: GameState }) {
  const { playerId, code, log, send, command, leave } = useGame()
  const t = useI18n((state) => state.t)
  const [pending, setPending] = useState<ActionType | null>(null)
  const [showLog, setShowLog] = useState(false)

  const me = display.players.find((player) => player.id === playerId)
  const myTurn = game.players.find((player) => player.seat === game.turnSeat)?.id === playerId
  const { impactAt, impactPower } = useStage()
  const compact = useIsCompact()

  // Les animations se jouent à partir de l'état d'affichage, donc depuis les places
  // telles qu'elles sont disposées à l'écran en ce moment.
  useDirector(me?.seat ?? 0, Math.max(1, display.players.length))

  const actions = useMemo(() => legalActions(game, playerId), [game, playerId])

  // Le tour est passé : toute sélection de cible en cours n'a plus d'objet.
  useEffect(() => {
    if (!myTurn) setPending(null)
  }, [myTurn])

  const types = useMemo(
    () => ACTION_ORDER.filter((type) => actions.some((action) => action.type === type)),
    [actions],
  )

  const selectableIds = useMemo(() => {
    if (!pending) return new Set<string>()
    return new Set(
      actions
        .filter((action) => action.type === pending && 'targetId' in action)
        .map((action) => ('targetId' in action ? action.targetId : '')),
    )
  }, [actions, pending])

  const current = display.players.find((player) => player.seat === display.turnSeat)
  const winner = display.players.find((player) => player.id === display.winnerId)
  const accent = seatColor(display.turnSeat)

  const choose = (type: ActionType) => {
    setPending((value) => (value === type ? null : type))
  }

  const selectTarget = (targetId: string) => {
    if (!pending) return
    send({ type: pending, targetId } as never)
    setPending(null)
  }

  return (
    <div
      className="relative h-dvh w-full overflow-hidden"
      style={{
        background: `radial-gradient(120% 90% at 50% 38%, ${accent}26 0%, #3a0d14 38%, #140508 100%)`,
      }}
    >
      {/* Plaques de nom : du DOM que la scène vient coller sur chaque siège. Le joueur
          local n'en a pas, son identité vit dans le coin de l'écran.
          Le `z-index` est indispensable : sans lui la couche passe sous le canvas WebGL,
          et chaque plaque se fait rogner par le bord de la table. */}
      <div className="pointer-events-none absolute inset-0 z-10 overflow-hidden">
        {display.players
          .filter((player) => player.seat !== (me?.seat ?? 0))
          .map((player) => (
            <Nameplate
              key={player.id}
              player={player}
              isTurn={player.seat === display.turnSeat && display.phase === 'playing'}
              alive={isAlive(player)}
            />
          ))}
      </div>

      {/* Éclair d'impact. La clé relance l'animation à chaque choc. */}
      {impactPower > 0 && (
        <div
          key={impactAt}
          className="pb-flash pointer-events-none absolute inset-0 z-20 bg-white"
          style={{ ['--pb-flash' as string]: impactPower * 0.3 }}
        />
      )}

      <GameScene
        game={display}
        mySeat={me?.seat ?? 0}
        compact={compact}
        selectableIds={selectableIds}
        onSelectTarget={selectTarget}
      />

      {/* ------------------------------ bandeau haut ------------------------------ */}
      <header className="pointer-events-none absolute inset-x-0 top-0 z-30 flex flex-wrap items-start gap-2 p-2 sm:gap-3 sm:p-3">
        {/* `backdrop-blur` crée un contexte d'empilement : sans z-index sur ce
            conteneur, le panneau de réglages passerait sous ses voisins. */}
        <div className="pointer-events-auto relative z-40 flex items-center gap-2 rounded-full bg-black/45 px-3 py-1.5 backdrop-blur-sm">
          <span className="font-mono text-sm tracking-widest text-slate-100">{code}</span>
          <SettingsMenu />
          <button className="text-xs text-slate-400 underline" onClick={() => void leave()}>
            {t.table.leave}
          </button>
        </div>

        {/* Sur écran étroit l'indicateur de tour passe sur sa propre ligne plutôt que
            de comprimer les deux autres blocs. */}
        <p className="pointer-events-none order-last mx-auto w-full rounded-full bg-black/45 px-4 py-1.5 text-center text-xs backdrop-blur-sm sm:order-none sm:w-auto sm:text-sm">
          {display.phase === 'lobby' && t.table.waiting}
          {display.phase === 'playing' && t.table.turnOf(current?.name ?? '?')}
          {display.phase === 'finished' && t.table.wins(winner?.name ?? '?')}
        </p>

        {/* Sur mobile l'identité monte dans l'en-tête : le bas de l'écran est
            entièrement rendu à la barre d'action. */}
        {me && compact && (
          <div
            className="pointer-events-none flex items-center gap-1 rounded-full bg-black/45 px-2 py-1 text-[11px] font-semibold backdrop-blur-sm"
            style={{ color: seatColor(me.seat) }}
          >
            {me.name}
            {me.isHost && <span>👑</span>}
            {me.hasSuperPower && <span>💥</span>}
            {me.battery && <span>🔋</span>}
          </div>
        )}

        {me?.isHost && (
          <div className="pointer-events-auto flex gap-2 text-[11px] sm:text-sm">
            {display.phase === 'lobby' && (
              <button
                className={BTN}
                disabled={display.players.length < 2}
                onClick={() => command('start')}
              >
                {t.table.start}
              </button>
            )}
            {display.phase !== 'lobby' && (
              <button className={BTN_GHOST} onClick={() => command('restart')}>
                {t.table.restart}
              </button>
            )}
            {display.phase === 'playing' && (
              <button className={BTN_GHOST} onClick={() => command('skip')}>
                {t.table.skipTurn}
              </button>
            )}
          </div>
        )}
      </header>

      {/* ------------------------------ barre d'action ------------------------------ */}
      {types.length > 0 && (
        <div className="absolute inset-x-0 bottom-0 z-30 flex flex-col items-center gap-2 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:p-4">
          <p className="rounded-full bg-black/70 px-4 py-1.5 text-sm">
            {pending ? t.table.chooseTarget(t.actions[pending]) : t.table.chooseAction}
          </p>
          <div className="flex max-w-full flex-wrap justify-center gap-2">
            {types.map((type) => (
              <button
                key={type}
                onClick={() => choose(type)}
                className={`rounded-full border px-3 py-2 text-xs font-semibold transition sm:px-4 sm:text-sm ${
                  pending === type
                    ? 'border-emerald-200 bg-emerald-400 text-slate-900 shadow-lg shadow-emerald-500/30'
                    : 'border-white/25 bg-white/15 text-white hover:border-white/50 hover:bg-white/25'
                }`}
              >
                {t.actions[type]}
              </button>
            ))}
            {pending && (
              <button
                className="rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm text-slate-200 hover:bg-white/20"
                onClick={() => setPending(null)}
              >
                ✕
              </button>
            )}
          </div>
        </div>
      )}

      {/* ------------------------------ journal ------------------------------ */}
      {/* Décalés vers le haut sur mobile : la barre d'action occupe déjà le bas. */}
      <div className="absolute bottom-28 left-2 z-30 max-w-[16rem] sm:bottom-3 sm:left-3 sm:max-w-[22rem]">
        <button
          className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs text-slate-200 hover:bg-white/20"
          onClick={() => setShowLog((value) => !value)}
        >
          {t.table.log} {showLog ? '▾' : '▸'}
        </button>
        {showLog && (
          <ol className="mt-2 max-h-64 overflow-auto rounded-lg bg-black/60 p-3 font-mono text-[11px] text-slate-300 backdrop-blur-sm">
            {log.map((entry) => (
              <li key={entry.id} className="whitespace-pre-wrap">
                {entry.kind === 'event'
                  ? describeEvent(entry.event, t, display)
                  : describeRejection(entry.code, t)}
              </li>
            ))}
          </ol>
        )}
      </div>

      {/* Identité du joueur local : elle vit ici et non sur le tapis, où elle
          recouvrirait ses propres cartes. */}
      {me && !compact && (
        <div
          className="absolute right-3 bottom-3 z-30 flex items-center gap-1.5 rounded-full bg-black/55 px-3 py-1.5 text-sm font-semibold backdrop-blur-sm"
          style={{ color: seatColor(me.seat) }}
        >
          {me.name}
          <span className="opacity-60">{t.table.me}</span>
          {me.isHost && <span>👑</span>}
          {me.hasSuperPower && <span title={t.table.superPower}>💥</span>}
          {me.battery && <span title={t.table.battery}>🔋</span>}
          {!isAlive(me) && <span className="text-rose-400">☠</span>}
        </div>
      )}

      {display.phase === 'finished' && winner && (
        <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center">
          <p className="rounded-2xl bg-black/70 px-6 py-4 text-xl font-bold backdrop-blur-sm sm:px-8 sm:py-5 sm:text-3xl">
            {t.table.wins(winner.name)}
          </p>
        </div>
      )}
    </div>
  )
}

const BTN =
  'rounded-full bg-emerald-400 px-4 py-1.5 text-sm font-semibold text-slate-900 transition hover:bg-emerald-300 disabled:opacity-40'
const BTN_GHOST =
  'rounded-full border border-white/25 bg-white/15 px-4 py-1.5 text-sm font-medium text-white transition hover:border-white/50 hover:bg-white/25'
