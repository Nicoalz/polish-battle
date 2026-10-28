import { useEffect, useRef } from 'react'
import type { Card, GameEvent, GameState } from '@pb/engine'
import { useGame, type Batch } from '../net/store'
import { useSettings } from '../settings'
import { playSfx, vibrate, type Sfx } from '../audio/synth'
import { DEAL_PENDING, dealCount, useStage, type Deal, type Narration } from './stage'
import { DECK_POSITION, DRAWN_CARD_POSITION, seatAnchor } from './seats'

/**
 * Chef d'orchestre des animations.
 *
 * Le serveur diffuse, pour chaque action, le récit de ce qui s'est passé. Ce module le
 * rejoue à la bonne vitesse : il fait voler la carte, déclenche l'impact, puis seulement
 * **alors** laisse l'affichage rattraper l'état autoritaire. C'est ce décalage assumé qui
 * fait qu'on voit l'attaque arriver avant d'en voir l'effet.
 */

const DURATIONS = {
  /** Temps laissé à la table pour lire la carte qui vient de se dévoiler. */
  reveal: 820,
  /** Addition attaque + charge : il faut pouvoir lire les deux avant qu'elles fusionnent. */
  combine: 1600,
  place: 460,
  attack: 520,
  superWindup: 420,
  superFlight: 640,
  settle: 420,
  victory: 700,
  /** Temps de lecture d'une annonce qui n'a rien à montrer — un tour passé. */
  narrate: 900,
  /** Intervalle entre deux cartes servies. */
  dealCard: 85,
  /** Durée du vol d'une carte distribuée. */
  dealFlight: 330,
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

/**
 * Qui joue, et quoi.
 *
 * Déduit du récit plutôt que de l'état : le lot d'événements dit déjà tout, et le lire
 * ici évite de comparer deux états pour retrouver une information qu'on a sous la main.
 *
 * La cible manque volontairement pour les coups qui s'envolent — elle sera ajoutée au
 * départ de la carte. Une résurrection, elle, vise quelqu'un de visiblement mort : il
 * n'y a là aucun suspense à préserver.
 */
function narrationOf(events: GameEvent[]): Narration | undefined {
  const attack = events.find((event) => event.t === 'attack-resolved')
  if (attack) {
    return { kind: attack.kind === 'super' ? 'super-attack' : 'attack', byId: attack.fromId }
  }

  const shield = events.find((event) => event.t === 'shield-set')
  if (shield) {
    return { kind: shield.kind === 'super' ? 'super-shield' : 'shield', byId: shield.byId }
  }

  const charge = events.find((event) => event.t === 'battery-set')
  if (charge) return { kind: 'charge', byId: charge.byId }

  const revived = events.find((event) => event.t === 'resurrected')
  if (revived) return { kind: 'resurrect', byId: revived.byId, toId: revived.playerId }

  // Reste le tour perdu. Il se lit sur son propre événement : reconstituer le joueur
  // précédent à partir de l'affichage donnait le mauvais nom dès que deux tours
  // s'enchaînaient plus vite que la mise en scène ne les raconte.
  const skipped = events.find((event) => event.t === 'turn-skipped')
  return skipped ? { kind: 'skip', byId: skipped.playerId } : undefined
}

/**
 * Carte résultante d'une addition.
 *
 * Son rang ne descend jamais à zéro : c'est ce qui marque la carte maudite, et un total
 * nul se lirait à tort comme une malédiction plutôt que comme un coup dans le vide.
 */
function sumOf(attack: Card, charge: Card): Card {
  const value = attack.value + charge.value
  return { id: `sum:${attack.id}`, rank: Math.max(1, value), value }
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
        stage.narrate(undefined)
        stage.focus(undefined)
        stage.setFlight(undefined)
        stage.setReveal(undefined)
        stage.setCombination(undefined)
        // Sans ce filet, une donne interrompue laisserait la table vide : les sièges ne
        // montrent leurs cartes qu'une fois l'horloge de distribution retirée.
        stage.setDeal(undefined)
        // Rattrapage de sécurité : on valide la dernière version effectivement reçue.
        commit(useGame.getState().version)
        setAnimating(false)
        running.current = false
      }
    })()
  }, [queued, mySeat, total])
}

/**
 * Sert la table.
 *
 * Le rideau tombe d'abord — sinon la nouvelle donne apparaît d'un bloc le temps d'une
 * image, avant même qu'on sache quoi distribuer. L'état est ensuite validé, et seule
 * l'horloge de distribution décide de ce qui est déjà posé.
 *
 * L'attente échappe au budget des autres mises en scène : celui-ci existe pour ne pas
 * prendre de retard sur une file d'actions, or une donne n'arrive qu'une fois par manche
 * et n'a rien derrière elle.
 */
async function dealOut(
  instant: boolean,
  scale: number,
  commit: () => Promise<void>,
): Promise<void> {
  const stage = useStage.getState()

  if (instant) {
    await commit()
    return
  }

  stage.setDeal(DEAL_PENDING)
  await commit()

  const table = useGame.getState().display
  const players = table?.players.length ?? 0
  const lifeCount = table?.players[0]?.life.length ?? 0
  if (players === 0 || lifeCount === 0) {
    stage.setDeal(undefined)
    return
  }

  const deal: Deal = {
    startedAt: performance.now(),
    perCard: DURATIONS.dealCard * scale,
    flight: DURATIONS.dealFlight * scale,
    players,
    // On sert d'abord celui qui ouvrira : la distribution annonce déjà qui commence.
    firstSeat: table?.turnSeat ?? 0,
    lifeCount,
  }
  stage.setDeal(deal)

  for (let rank = 0; rank < dealCount(deal); rank++) {
    playSfx('place')
    await wait(deal.perCard)
  }
  await wait(deal.flight)

  stage.setDeal(undefined)
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
  /** Valide l'état **et** inscrit l'action à l'historique : les deux doivent coïncider. */
  const commit = async () => {
    await settle(version, deadline + 2000)
    useGame.getState().remember(events)
  }

  const started = events.find((event) => event.t === 'game-started')
  const attack = events.find((event) => event.t === 'attack-resolved')
  const superUsed = events.find((event) => event.t === 'super-used')
  const shield = events.find((event) => event.t === 'shield-set')
  const charge = events.find((event) => event.t === 'battery-set')
  const drawn = events.find((event) => event.t === 'drawn')
  const won = events.find((event) => event.t === 'game-won')

  // Début de manche : on sert la table carte par carte au lieu de la faire apparaître.
  // La distribution se passe de commentaire, et ce retour anticipé est la raison pour
  // laquelle l'annonce n'est posée qu'après lui : elle resterait sinon affichée.
  if (started) {
    await dealOut(instant, scale, commit)
    return
  }

  // Le coup s'annonce dès le début de sa mise en scène : sans cela la bannière nomme
  // encore le joueur précédent pendant que le suivant peut déjà agir.
  const story = narrationOf(events)
  if (story) stage.narrate(story)

  /** Hauteur à laquelle une carte quitte la main de son joueur. */
  const handOf = (playerId: string): [number, number, number] => {
    const seat = seatOf(before, playerId)
    return seat === undefined ? DECK_POSITION : seatAnchor(seat, mySeat, total, 0.45)
  }

  // Léger penché vers celui qui joue, et pour tous les coups : seuls les super-pouvoirs
  // déplaçaient la caméra, si bien qu'un tour ordinaire ne bougeait rien du tout. Le
  // super-pouvoir garde sa plongée entière, juste après — il ne s'agit pas de mettre
  // tous les coups sur le même plan, mais de ne plus laisser les plus courants muets.
  const actorSeat = story ? seatOf(before, story.byId) : undefined
  if (!quick && actorSeat !== undefined) stage.focus(actorSeat, 0.38)

  if (superUsed) {
    sound('super')
    if (!quick) {
      stage.focus(seatOf(before, superUsed.playerId))
      await hold(DURATIONS.superWindup)
    }
  }

  // Le coup était engagé à l'aveugle : c'est seulement maintenant que la carte se
  // montre, et toute la table la découvre en même temps que son auteur.
  if (drawn) {
    stage.setReveal({ card: drawn.card, from: handOf(drawn.playerId) })
    sound('draw')
    await hold(DURATIONS.reveal)
  }

  if (attack) {
    const fromSeat = seatOf(before, attack.fromId)
    const toSeat = seatOf(before, attack.toId)
    const duration = attack.kind === 'super' ? DURATIONS.superFlight : DURATIONS.attack

    // Une charge dépensée se découvre maintenant, et à ce seul moment : on la fait venir
    // de son siège, se retourner, puis s'additionner à la carte d'attaque.
    const [card, spent] = attack.cards
    let payload = attack.cards
    if (card && spent && fromSeat !== undefined) {
      payload = [sumOf(card, spent)]
      stage.setCombination({
        attack: card,
        charge: spent,
        total: payload[0]!,
        fromSeat,
        startedAt: performance.now(),
        duration: DURATIONS.combine * (quick ? 0.4 : 1),
      })
      sound('charge')
      await hold(DURATIONS.combine)
      stage.setCombination(undefined)
    }

    // La carte part : on peut enfin dire sur qui. Pas avant — ni pendant l'addition,
    // qui est justement le moment où la table retient son souffle.
    if (story) stage.narrate({ ...story, toId: attack.toId })

    if (toSeat !== undefined) {
      stage.setReveal(undefined)
      stage.setFlight({
        cards: payload,
        from: DRAWN_CARD_POSITION,
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
    if (story && target) stage.narrate({ ...story, toId: target.playerId })
    if (toSeat !== undefined && target) {
      stage.setReveal(undefined)
      stage.setFlight({
        cards: [target.card],
        // Un bouclier part du centre, où il vient d'être montré ; une charge part de la
        // main de son auteur, sans jamais s'être dévoilée. Dans les deux cas on sait
        // d'où vient le coup — c'est le dos de la carte qui dit qu'on en ignore la
        // valeur, pas son point de départ.
        from: shield ? DRAWN_CARD_POSITION : handOf(target.byId),
        to: seatAnchor(toSeat, mySeat, total, 0.7),
        kind: 'place',
        startedAt: performance.now(),
        duration: DURATIONS.place * scale,
      })
      sound(shield ? 'place' : 'charge')
      await hold(DURATIONS.place)
      stage.setFlight(undefined)
    }
    await commit()
    await hold(DURATIONS.settle * 0.6)
  } else {
    await commit()
    // Un tour passé n'a rien à montrer : il ne lui reste que le temps d'être lu.
    await hold(story ? DURATIONS.narrate : DURATIONS.settle * 0.6)
  }

  stage.setReveal(undefined)
  stage.focus(undefined)
  stage.narrate(undefined)

  if (won) {
    stage.impact(0.8)
    sound('win')
    await hold(DURATIONS.victory)
  }
}
