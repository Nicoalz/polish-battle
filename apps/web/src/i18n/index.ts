import { create } from 'zustand'
import { fr } from './fr'
import { en } from './en'
import type { Dict, Locale } from './types'

export type { Dict, Locale, RejectionCode } from './types'

const DICTS: Record<Locale, Dict> = { fr, en }
const LOCALE_KEY = 'pb.locale'

export const LOCALES = Object.keys(DICTS) as Locale[]

/** Langue retenue : choix explicite du joueur, sinon celle du navigateur, sinon le français. */
function detectLocale(): Locale {
  const saved = localStorage.getItem(LOCALE_KEY)
  if (saved === 'fr' || saved === 'en') return saved
  return navigator.language.toLowerCase().startsWith('fr') ? 'fr' : 'en'
}

type I18nStore = {
  locale: Locale
  t: Dict
  setLocale: (locale: Locale) => void
}

export const useI18n = create<I18nStore>((set) => {
  const locale = detectLocale()
  return {
    locale,
    t: DICTS[locale],
    setLocale: (next) => {
      localStorage.setItem(LOCALE_KEY, next)
      document.documentElement.lang = next
      set({ locale: next, t: DICTS[next] })
    },
  }
})

document.documentElement.lang = useI18n.getState().locale

/** Dictionnaire courant hors composant React (store réseau, utilitaires). */
export function dict(): Dict {
  return useI18n.getState().t
}
