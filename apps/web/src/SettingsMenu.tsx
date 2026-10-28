import { useRef, useState } from 'react'
import { LOCALES, useI18n } from './i18n'
import { useSettings } from './settings'
import { useDismiss } from './useDismiss'

/** Réglages du joueur, regroupés sous un seul bouton pour libérer la table. */
export function SettingsMenu() {
  const t = useI18n((state) => state.t)
  const { locale, setLocale } = useI18n()
  const {
    reducedMotion,
    sfxVolume,
    musicVolume,
    setReducedMotion,
    setSfxVolume,
    setMusicVolume,
  } = useSettings()
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  useDismiss(open, root, setOpen)

  return (
    <div ref={root} className="relative">
      <button
        className="rounded-full px-2 py-1 text-sm text-slate-200 transition hover:bg-white/15"
        aria-expanded={open}
        aria-label={t.settings.title}
        onClick={() => setOpen((value) => !value)}
      >
        ⚙
      </button>

      {open && (
        <div className="absolute top-full left-0 z-30 mt-2 w-60 rounded-xl bg-black/85 p-3 text-sm shadow-xl backdrop-blur-md">
          <p className="mb-2 font-semibold">{t.settings.title}</p>

          <p className="mb-1 text-xs text-slate-400">{t.settings.language}</p>
          <div className="mb-3 flex gap-1">
            {LOCALES.map((code) => (
              <button
                key={code}
                onClick={() => setLocale(code)}
                aria-pressed={code === locale}
                className={`flex-1 rounded px-2 py-1 text-xs font-semibold uppercase transition ${
                  code === locale
                    ? 'bg-emerald-400 text-slate-900'
                    : 'bg-white/15 text-slate-100 hover:bg-white/25'
                }`}
              >
                {code}
              </button>
            ))}
          </div>

          <Slider label={t.settings.sfx} value={sfxVolume} onChange={setSfxVolume} />
          <Slider label={t.settings.music} value={musicVolume} onChange={setMusicVolume} />

          <label className="mt-3 flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={reducedMotion}
              onChange={(event) => setReducedMotion(event.target.checked)}
            />
            {t.settings.reducedMotion}
          </label>
          <p className="mt-1 text-[11px] leading-snug text-slate-500">
            {t.settings.reducedMotionHint}
          </p>
        </div>
      )}
    </div>
  )
}

function Slider({
  label,
  value,
  onChange,
}: {
  label: string
  value: number
  onChange: (value: number) => void
}) {
  return (
    <label className="mb-2 block">
      <span className="mb-1 flex justify-between text-xs text-slate-400">
        {label}
        <span className="tabular-nums">{Math.round(value * 100)}%</span>
      </span>
      <input
        type="range"
        min={0}
        max={1}
        step={0.05}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="w-full accent-emerald-400"
      />
    </label>
  )
}
