import { create } from 'zustand'
import { setMusicVolume, setSfxVolume, startMusic, stopMusic } from './audio/synth'

/**
 * Réglages du joueur, conservés dans le navigateur.
 *
 * Volontairement séparés de l'état de jeu et de l'état de scène : ce sont des
 * préférences, elles survivent aux parties et n'ont pas à transiter par le réseau.
 */

const KEYS = {
  reducedMotion: 'pb.reducedMotion',
  sfx: 'pb.sfxVolume',
  music: 'pb.musicVolume',
} as const

function readNumber(key: string, fallback: number): number {
  const raw = localStorage.getItem(key)
  const value = raw === null ? Number.NaN : Number(raw)
  return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : fallback
}

function readReducedMotion(): boolean {
  const saved = localStorage.getItem(KEYS.reducedMotion)
  if (saved === 'true' || saved === 'false') return saved === 'true'
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

type Settings = {
  reducedMotion: boolean
  sfxVolume: number
  /** Coupée par défaut : une boucle qui tourne toute la soirée finit par gêner. */
  musicVolume: number

  setReducedMotion: (value: boolean) => void
  setSfxVolume: (value: number) => void
  setMusicVolume: (value: number) => void
  /** Applique les volumes au moteur audio, une fois celui-ci débloqué. */
  applyVolumes: () => void
}

export const useSettings = create<Settings>((set, get) => ({
  reducedMotion: readReducedMotion(),
  sfxVolume: readNumber(KEYS.sfx, 0.7),
  musicVolume: readNumber(KEYS.music, 0),

  setReducedMotion(value) {
    localStorage.setItem(KEYS.reducedMotion, String(value))
    set({ reducedMotion: value })
  },

  setSfxVolume(value) {
    localStorage.setItem(KEYS.sfx, String(value))
    setSfxVolume(value)
    set({ sfxVolume: value })
  },

  setMusicVolume(value) {
    localStorage.setItem(KEYS.music, String(value))
    setMusicVolume(value)
    if (value > 0) startMusic()
    else stopMusic()
    set({ musicVolume: value })
  },

  applyVolumes() {
    const { sfxVolume, musicVolume } = get()
    setSfxVolume(sfxVolume)
    setMusicVolume(musicVolume)
    if (musicVolume > 0) startMusic()
  },
}))
