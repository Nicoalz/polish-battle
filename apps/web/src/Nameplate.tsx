import { useEffect, useRef } from 'react'
import type { PlayerState } from '@pb/engine'
import { Avatar } from './Avatar'
import { registerPlate } from './scene/nameplates'
import { seatColor } from './scene/seats'

/**
 * Plaque de nom d'un joueur.
 *
 * Rendue dans la couche d'interface, puis déplacée à chaque image par la scène pour
 * suivre son siège. Le texte reste donc net et de taille constante, quelle que soit la
 * distance — ce qui compte plus, sur une table à huit, que la perspective.
 */
export function Nameplate({
  player,
  isTurn,
  alive,
  reaction,
}: {
  player: PlayerState
  isTurn: boolean
  alive: boolean
  reaction?: { emote: string; at: number }
}) {
  const element = useRef<HTMLDivElement>(null)
  const color = seatColor(player.seat)

  useEffect(() => {
    registerPlate(player.id, element.current)
    return () => registerPlate(player.id, null)
  }, [player.id])

  return (
    <div
      ref={element}
      // Invisible tant que la scène ne l'a pas placée : sinon elle apparaîtrait une
      // image dans le coin supérieur gauche.
      style={{
        color,
        opacity: 0,
        boxShadow: isTurn ? `0 0 0 2px ${color}` : undefined,
      }}
      // Pas de `backdrop-blur` ici : la plaque est repositionnée à chaque image, et un
      // filtre de fond coûte cher dans ces conditions. Un fond opaque suffit à la
      // détacher du tapis.
      className={`absolute top-0 left-0 flex items-center gap-1.5 rounded-full py-1 pr-3 pl-1 text-[13px] font-semibold whitespace-nowrap ${
        alive ? 'bg-black/80' : 'bg-black/60 line-through opacity-60'
      }`}
    >
      {reaction && <Reaction reaction={reaction} />}
      <Avatar id={player.avatar} size={20} className="shrink-0" />
      {player.name}
      {player.isHost && <span>👑</span>}
      {player.hasSuperPower && <span>💥</span>}
      {player.battery && <span>🔋</span>}
      {!player.connected && <span className="text-amber-300">⚡︎</span>}
    </div>
  )
}

/**
 * Bulle de réaction, posée au-dessus d'une plaque.
 *
 * L'horodatage sert de clé : sans lui, réagir deux fois de suite avec le même visage
 * ne relancerait pas l'animation, et la seconde réaction passerait inaperçue.
 */
export function Reaction({ reaction }: { reaction: { emote: string; at: number } }) {
  return (
    <span
      key={reaction.at}
      aria-hidden
      className="pb-emote pointer-events-none absolute -top-8 left-1/2 text-2xl"
    >
      {reaction.emote}
    </span>
  )
}
