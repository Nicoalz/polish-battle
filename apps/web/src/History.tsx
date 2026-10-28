import { useEffect, useRef, useState } from 'react'
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
 *
 * Replié par défaut. Chaque siège porte maintenant un portrait, et un panneau de vingt
 * lignes épinglé sur la table se pose forcément sur l'un d'eux — il n'existe aucune
 * bande libre au-dessus d'un tapis à huit places. Ce qui se passe à l'instant se lit
 * désormais dans le bandeau ; l'historique redevient ce qu'il est, un retour en arrière
 * qu'on demande.
 */
export function History({ game }: { game: GameState }) {
  const log = useGame((state) => state.log)
  const t = useI18n((state) => state.t)
  const box = useRef<HTMLDivElement>(null)
  const stuckToBottom = useRef(true)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const element = box.current
    if (element && stuckToBottom.current) element.scrollTop = element.scrollHeight
  }, [log, open])

  return (
    <section // Sur mobile l'en-tête occupe trois lignes : l'historique se place en dessous.
      className={`pointer-events-auto absolute top-36 right-2 z-30 rounded-xl bg-black/65 text-slate-200 sm:top-16 sm:right-3 ${
        open ? 'w-56 p-2 sm:w-80 sm:p-3' : 'p-1'
      }`}
    >
      <h2 className={open ? 'mb-1' : undefined}>
        <button
          className="flex items-center gap-1.5 rounded-lg px-1.5 py-0.5 text-[10px] font-semibold tracking-widest text-slate-400 uppercase transition hover:text-slate-100"
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
        >
          {t.history.title}
          <span aria-hidden className="text-[9px]">
            {open ? '▴' : '▾'}
          </span>
          {!open && log.length > 0 && (
            <span className="rounded-full bg-white/15 px-1.5 text-[10px] tabular-nums">
              {log.length}
            </span>
          )}
        </button>
      </h2>

      <div
        hidden={!open}
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
