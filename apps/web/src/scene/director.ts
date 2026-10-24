import { useEffect, useRef } from 'react'
import type { GameState } from '@pb/engine'
import { useGame, type Batch } from '../net/store'
import { useSettings } from '../settings'
import { playSfx, vibrate, type Sfx } from '../audio/synth'
import { useStage } from './stage'
import { DRAWN_CARD_POSITION, seatAnchor } from './seats'

/**
 * Chef d'orchestre des animations.
 *
 * Le serveur diffuse, pour chaque action, le récit de ce qui s'est passé. Ce module le
 * rejoue à la bonne vitesse : il fait voler la carte, déclenche l'impact, puis seulement
 * **alors** laisse l'affichage rattraper l'état autoritaire. C'est ce décalage assumé qui
 * fait qu'on voit l'attaque arriver avant d'en voir l'effet.
 */

const DURATIONS = {
  draw: 620,
  place: 460,
  attack: 520,
  superWindup: 420,
  superFlight: 640,
  settle: 420,
  victory: 700,
} as const

/** Budget maximal d'attente pour une action, au-delà duquel on rattrape sans attendre. */
const BATCH_BUDGET_MS = 2600

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Cadence d'une mise en scène.
 *
 * Les navigateurs brident les minuteries des onglets qui n'ont pas le focus. Comme
 * l'affichage n'avance qu'au rythme des animations, une telle mise en scène qui traîne
 * figerait la partie pour ce joueur. On joue donc sans attendre quand personne ne
 * regarde, on accélère quand on a pris du retard, et on abandonne les attentes restantes
 * passé un budget : la mise en scène est un confort, jamais une condition.
 */
function pacing(): { instant: boolean; scale: number } {
  const { reducedMotion } = useSettings.getState()
  if (document.hidden) return { instant: true, scale: 0 }
  if (reducedMotion) return { instant: false, scale: 0.25 }
  // Plus d'un lot en attente : on a du retard sur la partie, on presse le pas.
  if (useGame.getState().queue.length >= 1) return { instant: false, scale: 0.45 }
  return { instant: false, scale: 1 }
}

function seatOf(state: GameState | undefined, playerId: string): number | undefined {
  return state?.players.find((player) => player.id === playerId)?.seat
}

export function useDirector(mySeat: number, total: number): void {
  const running = useRef(false)
  const queued = useGame((state) => state.queue.length)

  useEffect(() => {
    if (running.current || queued === 0) return
    running.current = true

    void (async () => {
      const { consume, commit, setAnimating } = useGame.getState()
      const stage = useStage.getState()
      setAnimating(true)

      try {
        for (let batch = consume(); batch; batch = useGame.getState().consume()) {
          await play(batch, mySeat, total)
        }
      } finally {
        // Quoi qu'il arrive — exception, minuterie bridée, onglet masqué — l'affichage
        // rattrape l'état autoritaire et la main est rendue.
        stage.focus(undefined)
        stage.setFlight(undefined)
        // Rattrapage de sécurité : on valide la dernière version effectivement reçue.
        commit(useGame.getState().version)
        setAnimating(false)
        running.current = false
      }
    })()
  }, [queued, mySeat, total])
}

/**
 * Fait rattraper l'affichage, une fois l'état autoritaire parvenu à la version du lot.
 *
 * Sans cette attente, on validerait l'état d'avant l'action : les deux canaux ne sont
 * pas synchrones et les événements arrivent presque toujours avant leur correctif.
 */
async function settle(version: number, deadline: number): Promise<void> {
  while (useGame.getState().version < version && performance.now() < deadline) {
    await wait(16)
  }
  useGame.getState().commit(version)
}

async function play(batch: Batch, mySeat: number, total: number): Promise<void> {
  const stage = useStage.getState()
  const before = useGame.getState().display
  const { instant, scale } = pacing()
  const quick = instant || scale < 0.5
  const deadline = performance.now() + BATCH_BUDGET_MS

  const hold = async (ms: number) => {
    if (instant || performance.now() > deadline) return
    await wait(ms * scale)
  }

  // Onglet masqué : on rattrape en silence, personne n'est là pour entendre.
  const sound = (name: Sfx) => {
    if (!instant) playSfx(name)
  }

  const { events, version } = batch
  const commit = () => settle(version, deadline + 2000)

  const attack = events.find((event) => event.t === 'attack-resolved')
  const superUsed = events.find((event) => event.t === 'super-used')
  const shield = events.find((event) => event.t === 'shield-set')
  const charge = events.find((event) => event.t === 'battery-set')
  const won = events.find((event) => event.t === 'game-won')

  // Piocher : la carte surgit du paquet. L'animation d'entrée est portée par la carte
  // elle-même, il suffit de la laisser respirer.
  if (events.some((event) => event.t === 'drawn')) {
    sound('draw')
    await commit()
    await hold(DURATIONS.draw)
    return
  }

  if (superUsed) {
    sound('super')
    if (!quick) {
      stage.focus(seatOf(before, superUsed.playerId))
      await hold(DURATIONS.superWindup)
    }
  }

  if (attack) {
    const fromSeat = seatOf(before, attack.fromId)
    const toSeat = seatOf(before, attack.toId)
    const duration = attack.kind === 'super' ? DURATIONS.superFlight : DURATIONS.attack

    if (toSeat !== undefined) {
      stage.setFlight({
        cards: attack.cards,
        // Une attaque normale part de la carte posée au centre ; un super-pouvoir tire
        // sa carte de nulle part, donc du siège de son auteur.
        from:
          attack.kind === 'super' && fromSeat !== undefined
            ? seatAnchor(fromSeat, mySeat, total, 1.3)
            : DRAWN_CARD_POSITION,
        to: seatAnchor(toSeat, mySeat, total, 0.7),
        kind: 'attack',
        startedAt: performance.now(),
        duration: duration * scale,
      })
      sound('attack')
      await hold(duration)
      stage.setFlight(undefined)
    }

    // L'impact et les dégâts arrivent ensemble : c'est tout l'intérêt du décalage.
    const landed = attack.dealt > 0
    stage.impact(landed ? 1 : 0.35, toSeat)
    sound(landed ? 'impact' : 'blocked')
    if (!instant) vibrate(landed ? 40 : 12)
    await commit()

    if (events.some((event) => event.t === 'life-destroyed')) sound('destroy')
    if (events.some((event) => event.t === 'player-died')) sound('death')
    await hold(DURATIONS.settle)
  } else if (shield || charge) {
    const target = shield ?? charge
    const toSeat = target ? seatOf(before, target.playerId) : undefined
    if (toSeat !== undefined && target) {
      stage.setFlight({
        cards: [target.card],
        from: DRAWN_CARD_POSITION,
        to: seatAnchor(toSeat, mySeat, total, 0.7),
        kind: 'place',
        startedAt: performance.now(),
        duration: DURATIONS.place * scale,
      })
      sound(target.t === 'battery-set' ? 'charge' : 'place')
      await hold(DURATIONS.place)
      stage.setFlight(undefined)
    }
    await commit()
    await hold(DURATIONS.settle * 0.6)
  } else {
    await commit()
    await hold(DURATIONS.settle * 0.6)
  }

  stage.focus(undefined)

  if (won) {
    stage.impact(0.8)
    sound('win')
    await hold(DURATIONS.victory)
  }
}
