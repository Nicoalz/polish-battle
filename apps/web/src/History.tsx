import { useEffect, useRef } from 'react'
import type { GameState } from '@pb/engine'
import { useGame } from './net/store'
import { useI18n } from './i18n'
import { describeAction, describeRejection } from './i18n/history'

/**
 * Historique des coups, une ligne par action.
 *
 * Il montre les derniers coups et se laisse remonter : une partie se suit en lisant
 * « qui a fait quoi à qui », pas la liste des événements qui composent chaque coup.
 * Le défilement reste collé au dernier coup, sauf si le joueur est justement en train
 * de relire le passé — auquel cas on ne lui arrache pas sa lecture.
 */
export function History({ game }: { game: GameState }) {
  const log = useGame((state) => state.log)
  const t = useI18n((state) => state.t)
  const box = useRef<HTMLDivElement>(null)
  const stuckToBottom = useRef(true)

  useEffect(() => {
    const element = box.current
    if (element && stuckToBottom.current) element.scrollTop = element.scrollHeight
  }, [log])

  return (
    <section // Sur mobile l'en-tête occupe trois lignes : l'historique se place en dessous.
      className="pointer-events-auto absolute top-36 right-2 z-30 w-56 rounded-xl bg-black/65 p-2 text-slate-200 sm:top-16 sm:right-3 sm:w-80 sm:p-3">
      <h2 className="mb-1 text-[10px] font-semibold tracking-widest text-slate-400 uppercase">
        {t.history.title}
      </h2>
      <div
        ref={box}
        onScroll={(event) => {
          const el = event.currentTarget
          stuckToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 24
        }}
        className="max-h-20 overflow-y-auto overscroll-contain text-[11px] leading-snug sm:max-h-28 sm:text-xs"
      >
        {log.length === 0 && <p className="text-slate-500">{t.history.empty}</p>}
        <ol className="flex flex-col gap-1">
          {log.map((entry) => (
            <li
              key={entry.id}
              className={entry.kind === 'rejection' ? 'text-rose-300' : undefined}
            >
              {entry.kind === 'action'
                ? describeAction(entry.events, t, game)
                : describeRejection(entry.code, t)}
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}
