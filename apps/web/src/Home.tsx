import { useEffect, useState } from 'react'
import { AVATARS, toAvatar } from '@pb/engine'
import { Avatar } from './Avatar'
import { useGame } from './net/store'
import { getSavedAvatar, getSavedName } from './net/identity'
import { useI18n } from './i18n'
import { LocaleSwitch } from './i18n/LocaleSwitch'
import { useSettings } from './settings'
import { unlockAudio } from './audio/synth'

/** Code de salon court et sans ambiguïté visuelle (ni O/0 ni I/1). */
function randomCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  return Array.from(
    { length: 4 },
    () => alphabet[Math.floor(Math.random() * alphabet.length)],
  ).join('')
}

const REFRESH_MS = 5000

export function Home() {
  const { status, error, connect, openRooms, refreshRooms } = useGame()
  const t = useI18n((state) => state.t)

  const [name, setName] = useState(getSavedName)
  const [avatar, setAvatar] = useState(() => toAvatar(getSavedAvatar()))
  const [code, setCode] = useState('')
  const [visibility, setVisibility] = useState<'public' | 'private'>('public')

  // Le code du salon vit dans l'URL : partager le lien suffit à inviter.
  useEffect(() => {
    const fromUrl = new URLSearchParams(window.location.search).get('salon')
    if (fromUrl) setCode(fromUrl.toUpperCase())
  }, [])

  // La liste se rafraîchit toute seule : un salon ouvert pendant qu'on hésite doit apparaître.
  useEffect(() => {
    void refreshRooms()
    const timer = window.setInterval(() => void refreshRooms(), REFRESH_MS)
    return () => window.clearInterval(timer)
  }, [refreshRooms])

  const ready = name.trim().length > 0
  const join = (roomCode: string, wanted: 'public' | 'private' = 'private') => {
    const target = roomCode.trim().toUpperCase()
    if (!target || !ready) return
    // Un navigateur refuse de produire du son hors d'un geste utilisateur : c'est ici,
    // et nulle part ailleurs, qu'on peut ouvrir le contexte audio.
    unlockAudio()
    useSettings.getState().applyVolumes()
    const url = new URL(window.location.href)
    url.searchParams.set('salon', target)
    window.history.replaceState({}, '', url)
    void connect(target, name.trim(), avatar, wanted)
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col gap-5 p-6">
      <header className="flex flex-col items-center gap-1 pt-4">
        <h1 className="text-3xl font-bold">{t.app.title}</h1>
        <p className="text-center text-sm text-slate-400">{t.home.tagline}</p>
        <LocaleSwitch className="mt-1" />
      </header>

      <section>
        <p className={LABEL}>{t.home.avatar}</p>
        <div className="grid grid-cols-6 gap-1.5">
          {AVATARS.map((face) => (
            <button
              key={face.id}
              onClick={() => setAvatar(face.id)}
              aria-pressed={face.id === avatar}
              // Le portrait est décoratif : c'est la coupe qui le nomme à voix haute.
              aria-label={t.avatars[face.id]}
              title={t.avatars[face.id]}
              // Rond plutôt que carré : l'anneau de sélection épouse alors le portrait
              // au lieu de laisser quatre coins vides autour de lui.
              className={`aspect-square overflow-hidden rounded-full transition ${
                face.id === avatar
                  ? 'ring-2 ring-emerald-300 brightness-110'
                  : 'opacity-75 hover:opacity-100'
              }`}
            >
              <Avatar id={face.id} className="h-full w-full" />
            </button>
          ))}
        </div>
      </section>

      <label className="flex flex-col gap-1">
        <span className={LABEL}>{t.lobby.nickname}</span>
        <input
          className={INPUT}
          value={name}
          maxLength={16}
          placeholder={t.lobby.nicknamePlaceholder}
          onChange={(event) => setName(event.target.value)}
        />
      </label>

      <section className="flex flex-col gap-2">
        <p className={LABEL}>{t.home.joinByCode}</p>
        <div className="flex gap-2">
          <input
            className={`${INPUT} flex-1 font-mono uppercase tracking-widest`}
            value={code}
            maxLength={8}
            placeholder={t.lobby.roomCodePlaceholder}
            onChange={(event) => setCode(event.target.value.toUpperCase())}
            onKeyDown={(event) => event.key === 'Enter' && join(code)}
          />
          <button className={PRIMARY} disabled={!ready || !code.trim()} onClick={() => join(code)}>
            {status === 'connecting' ? t.lobby.joining : t.lobby.join}
          </button>
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <p className={LABEL}>{t.home.create}</p>
        <div className="flex gap-1.5">
          {(['public', 'private'] as const).map((choice) => (
            <button
              key={choice}
              onClick={() => setVisibility(choice)}
              aria-pressed={choice === visibility}
              className={`flex-1 rounded-lg py-2 text-sm font-semibold transition ${
                choice === visibility
                  ? 'bg-emerald-400 text-slate-900'
                  : 'bg-white/10 text-slate-200 hover:bg-white/20'
              }`}
            >
              {choice === 'public' ? t.home.createPublic : t.home.createPrivate}
            </button>
          ))}
        </div>
        <button className={PRIMARY} disabled={!ready} onClick={() => join(randomCode(), visibility)}>
          {t.home.create}
        </button>
        <p className="text-xs text-slate-500">{t.home.visibilityHint}</p>
      </section>

      <section className="flex flex-col gap-2">
        <p className={LABEL}>{t.home.openRooms}</p>
        {openRooms.length === 0 && <p className="text-sm text-slate-500">{t.home.noRooms}</p>}
        <ul className="flex flex-col gap-1.5">
          {openRooms.map((room) => {
            const running = room.phase === 'playing'
            return (
              <li
                key={room.code}
                className="flex items-center gap-3 rounded-lg border border-white/15 bg-white/5 px-3 py-2"
              >
                <span className="font-mono tracking-widest">{room.code}</span>
                <span className="text-xs text-slate-400">
                  {t.home.players(room.players)}
                  {running && ` · ${t.home.inProgress}`}
                </span>
                <button
                  className={`${GHOST} ml-auto`}
                  disabled={!ready || running}
                  // Plusieurs boutons « Rejoindre » coexistent : seul le code les distingue.
                  aria-label={`${t.lobby.join} ${room.code}`}
                  onClick={() => join(room.code)}
                >
                  {t.lobby.join}
                </button>
              </li>
            )
          })}
        </ul>
      </section>

      {error && <p className="text-center text-sm text-rose-400">{error}</p>}
    </div>
  )
}

const LABEL = 'mb-1.5 text-xs font-semibold tracking-widest text-slate-400 uppercase'
const INPUT =
  'rounded-lg border border-white/25 bg-white/5 px-3 py-2.5 outline-none transition focus:border-emerald-400 focus:bg-white/10'
const PRIMARY =
  'rounded-lg bg-emerald-400 px-4 py-2.5 font-semibold text-slate-900 transition hover:bg-emerald-300 disabled:opacity-40'
const GHOST =
  'rounded-lg border border-white/25 px-3 py-1.5 text-sm transition hover:bg-white/15 disabled:opacity-40'
