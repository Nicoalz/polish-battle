import { Suspense, lazy } from 'react'
import { useGame } from './net/store'
import { useI18n } from './i18n'
import { Home } from './Home'
import { DebugTable } from './debug/DebugTable'

// three.js et drei pèsent l'essentiel du bundle : on ne les charge qu'en entrant en
// partie, pour que l'accueil s'affiche instantanément.
const GameView = lazy(() => import('./GameView').then((m) => ({ default: m.GameView })))

export default function App() {
  const { status, game, display } = useGame()
  const t = useI18n((state) => state.t)

  if (status !== 'connected' || !game) return <Home />

  // `?debug` rebascule sur l'interface de développement, conservée comme outil. Elle
  // montre l'état autoritaire ; la scène montre l'état d'affichage, en retard du temps
  // que durent les animations.
  if (new URLSearchParams(window.location.search).has('debug')) return <DebugTable game={game} />

  return (
    <Suspense fallback={<Splash label={t.lobby.joining} />}>
      <GameView game={game} display={display ?? game} />
    </Suspense>
  )
}

function Splash({ label }: { label: string }) {
  return (
    <div className="flex min-h-dvh items-center justify-center text-sm text-slate-400">
      {label}
    </div>
  )
}
