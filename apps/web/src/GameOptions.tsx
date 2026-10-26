import { OPTION_KEYS, type GameOptions as Options, type OptionKey } from '@pb/engine'
import { useI18n } from './i18n'

/**
 * Réglages de la partie, au salon.
 *
 * Tout le monde les voit — c'est la règle du jeu qu'on s'apprête à jouer, pas un secret
 * d'hôte — mais seul l'hôte peut y toucher. La liste est produite à partir du catalogue
 * du moteur : ajouter une option ne demande rien ici.
 */
export function GameOptions({
  options,
  canEdit,
  onChange,
}: {
  options: Options
  canEdit: boolean
  onChange: (key: OptionKey, value: boolean) => void
}) {
  const t = useI18n((state) => state.t)

  return (
    <div className="pointer-events-auto w-[min(26rem,90vw)] rounded-2xl bg-black/70 p-3 backdrop-blur-sm">
      <p className="mb-2 text-xs font-semibold tracking-widest text-slate-400 uppercase">
        {t.options.title}
      </p>

      <ul className="flex flex-col gap-1.5">
        {OPTION_KEYS.map((key) => (
          <li key={key}>
            <label
              className={`flex items-start gap-3 rounded-xl px-2.5 py-2 transition ${
                canEdit ? 'cursor-pointer hover:bg-white/10' : 'opacity-70'
              }`}
            >
              <input
                type="checkbox"
                className="mt-0.5 size-4 shrink-0 accent-emerald-400"
                checked={options[key]}
                disabled={!canEdit}
                onChange={(event) => onChange(key, event.target.checked)}
              />
              <span className="min-w-0">
                <span className="block text-sm font-semibold">{t.options.labels[key]}</span>
                <span className="block text-xs text-slate-400">{t.options.hints[key]}</span>
              </span>
            </label>
          </li>
        ))}
      </ul>

      {!canEdit && <p className="mt-2 text-xs text-slate-500">{t.options.hostOnly}</p>}
    </div>
  )
}
