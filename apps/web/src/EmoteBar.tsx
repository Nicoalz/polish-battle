import { useRef, useState } from 'react'
import { EMOTES } from '@pb/engine'
import { useGame } from './net/store'
import { useI18n } from './i18n'
import { useDismiss } from './useDismiss'

/**
 * Réactions de table.
 *
 * Six boutons, repliés sous un seul : la table est petite sur un téléphone, et la
 * rangée ouverte en permanence mangerait l'en-tête. Une réaction part et ne laisse
 * rien — c'est au serveur de l'espacer, pas au bouton de se désactiver.
 */
export function EmoteBar() {
  const react = useGame((state) => state.react)
  const t = useI18n((state) => state.t)
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  useDismiss(open, root, setOpen)

  return (
    <div ref={root} className="relative">
      <button
        className="rounded-full px-2 py-1 text-sm transition hover:bg-white/15"
        aria-expanded={open}
        aria-label={t.table.react}
        onClick={() => setOpen((value) => !value)}
      >
        😮
      </button>

      {open && (
        <div className="absolute top-full left-0 z-30 mt-2 flex gap-0.5 rounded-full bg-black/85 p-1.5 shadow-xl backdrop-blur-md">
          {EMOTES.map((emote) => (
            <button
              key={emote}
              className="rounded-full px-2 py-1 text-xl leading-none transition hover:bg-white/20"
              onClick={() => {
                react(emote)
                setOpen(false)
              }}
            >
              {emote}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
