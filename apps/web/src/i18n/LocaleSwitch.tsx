import { LOCALES, useI18n } from './index'

export function LocaleSwitch({ className = '' }: { className?: string }) {
  const { locale, setLocale } = useI18n()

  return (
    <div className={`flex items-center gap-1 text-xs ${className}`}>
      {LOCALES.map((code) => (
        <button
          key={code}
          onClick={() => setLocale(code)}
          aria-pressed={code === locale}
          className={`rounded px-1.5 py-0.5 uppercase ${
            code === locale ? 'bg-white/15 text-slate-100' : 'text-slate-500 hover:text-slate-300'
          }`}
        >
          {code}
        </button>
      ))}
    </div>
  )
}
