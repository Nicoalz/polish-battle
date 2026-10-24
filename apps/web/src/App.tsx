import { Suspense, lazy, useEffect, useState } from 'react'
import { useGame } from './net/store'
import { useSettings } from './settings'
import { unlockAudio } from './audio/synth'
import { getSavedName } from './net/identity'
import { useI18n } from './i18n'
import { LocaleSwitch } from './i18n/LocaleSwitch'
import { DebugTable } from './debug/DebugTable'

// three.js et drei pèsent l'essentiel du bundle : on ne les charge qu'en entrant en
// partie, pour que le salon s'affiche instantanément.
const GameView = lazy(() => import('./GameView').then((m) => ({ default: m.GameView })))

/** Code de salon court et sans ambiguïté visuelle (ni O/0 ni I/1). */
function randomCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  return Array.from(
    { length: 4 },
    () => alphabet[Math.floor(Math.random() * alphabet.length)],
  ).join('')
}

export default function App() {
  const { status, error, game, display, connect } = useGame()
  const t = useI18n((state) => state.t)
  const [name, setName] = useState(getSavedName)
  const [code, setCode] = useState('')

  // Le code du salon vit dans l'URL : partager le lien suffit à inviter.
  useEffect(() => {
    const fromUrl = new URLSearchParams(window.location.search).get('salon')
    if (fromUrl) setCode(fromUrl.toUpperCase())
  }, [])

  // `?debug` rebascule sur l'interface de développement, conservée comme outil.
  const debugMode = new URLSearchParams(window.location.search).has('debug')
  if (status === 'connected' && game) {
    // L'outil de debug montre l'état autoritaire ; la scène montre l'état d'affichage,
    // qui attend que les animations aient raconté le coup.
    if (debugMode) return <DebugTable game={game} />
    return (
      <Suspense fallback={<Splash label={t.lobby.joining} />}>
        <GameView game={game} display={display ?? game} />
      </Suspense>
    )
  }

  const join = (roomCode: string) => {
    const target = roomCode.trim().toUpperCase()
    if (!target || !name.trim()) return
    // Un navigateur refuse de produire du son hors d'un geste utilisateur : c'est ici,
    // et nulle part ailleurs, qu'on peut ouvrir le contexte audio.
    unlockAudio()
    useSettings.getState().applyVolumes()
    const url = new URL(window.location.href)
    url.searchParams.set('salon', target)
    window.history.replaceState({}, '', url)
    void connect(target, name.trim())
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-4 p-6">
      <LocaleSwitch className="justify-center" />
      <h1 className="text-center text-3xl font-bold">{t.app.title}</h1>
      <p className="text-center text-sm text-slate-400">{t.app.devNotice}</p>

      <label className="flex flex-col gap-1 text-sm">
        {t.lobby.nickname}
        <input
          className={INPUT}
          value={name}
          maxLength={16}
          placeholder={t.lobby.nicknamePlaceholder}
          onChange={(event) => setName(event.target.value)}
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        {t.lobby.roomCode}
        <input
          className={`${INPUT} font-mono uppercase tracking-widest`}
          value={code}
          maxLength={8}
          placeholder={t.lobby.roomCodePlaceholder}
          onChange={(event) => setCode(event.target.value.toUpperCase())}
          onKeyDown={(event) => event.key === 'Enter' && join(code)}
        />
      </label>

      <button
        className="rounded bg-emerald-500 px-4 py-2 font-semibold text-slate-900 hover:bg-emerald-400 disabled:opacity-40"
        disabled={status === 'connecting' || !name.trim() || !code.trim()}
        onClick={() => join(code)}
      >
        {status === 'connecting' ? t.lobby.joining : t.lobby.join}
      </button>

      <button className="text-sm text-slate-400 underline" onClick={() => join(randomCode())}>
        {t.lobby.createRoom}
      </button>

      {error && <p className="text-center text-sm text-rose-400">{error}</p>}
    </div>
  )
}

const INPUT = 'rounded border border-white/20 bg-black/30 px-3 py-2 outline-none focus:border-emerald-400'

function Splash({ label }: { label: string }) {
  return (
    <div className="flex min-h-dvh items-center justify-center text-sm text-slate-400">
      {label}
    </div>
  )
}
