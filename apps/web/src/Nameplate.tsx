import { useEffect, useRef } from 'react'
import { EMOTE_TTL_MS, type PlayerState } from '@pb/engine'
import { Avatar } from './Avatar'
import { useI18n } from './i18n'
import { registerPlate } from './scene/nameplates'
import { seatColor } from './scene/seats'

/**
 * La place d'un joueur autour de la table.
 *
 * Un portrait, et son nom dessous : comme autour d'une table de jeu, c'est le visage
 * qui occupe le siège. L'avatar n'était qu'une vignette collée au pseudo, si bien que
 * rien ne reliait vraiment une personne à une place — or c'est la seule chose qui
 * permet de suivre une partie à huit sans lire les étiquettes une par une.
 *
 * Rendue dans la couche d'interface, puis déplacée à chaque image par la scène pour
 * suivre son siège. Le texte reste donc net et de taille constante, quelle que soit la
 * distance — ce qui compte plus, sur une table à huit, que la perspective.
 */
export function Nameplate({
  player,
  isTurn,
  alive,
  compact,
  reaction,
}: {
  player: PlayerState
  isTurn: boolean
  alive: boolean
  /** Écran étroit : le portrait se réduit pour laisser la table respirer. */
  compact: boolean
  reaction?: { emote: string; at: number }
}) {
  const element = useRef<HTMLDivElement>(null)
  const t = useI18n((state) => state.t)
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
      style={{ opacity: 0 }}
      className="absolute top-0 left-0 flex flex-col items-center gap-1"
    >
      {reaction && <Reaction reaction={reaction} />}

      {/* Le portrait, cerclé de la couleur du siège : la même que son halo sur le
          tapis, de sorte qu'un coup qui part d'une place se relie à un visage. */}
      <div
        className="relative rounded-full p-[2.5px]"
        style={{
          background: color,
          boxShadow: isTurn ? `0 0 0 3px ${color}55, 0 0 16px ${color}` : undefined,
        }}
      >
        <Avatar
          id={player.avatar}
          size={compact ? 38 : 52}
          className={`block rounded-full ${alive ? '' : 'opacity-45 grayscale'}`}
        />
        {!alive && (
          <span
            className="absolute inset-0 grid place-items-center text-lg"
            title={t.table.eliminated}
          >
            ☠
          </span>
        )}
      </div>

      {/* Pas de `backdrop-blur` ici : la plaque est repositionnée à chaque image, et un
          filtre de fond coûte cher dans ces conditions. Un fond opaque suffit à la
          détacher du tapis. */}
      <div
        className="flex items-center gap-1 rounded-full bg-black/80 px-2 py-0.5 text-[12px] font-semibold whitespace-nowrap"
        style={{ color }}
      >
        <span className={alive ? undefined : 'line-through opacity-60'}>{player.name}</span>
        {player.isHost && <span title={t.table.host}>👑</span>}
        {player.hasSuperPower && <span title={t.table.superPower}>💥</span>}
        {player.battery && <span title={t.table.battery}>🔋</span>}
        {!player.connected && (
          <span className="text-amber-300" title={t.table.disconnected}>
            ⚡︎
          </span>
        )}
      </div>
    </div>
  )
}

/**
 * Bulle de réaction, posée au-dessus d'une place.
 *
 * L'horodatage sert de clé : sans lui, réagir deux fois de suite avec le même visage
 * ne relancerait pas l'animation, et la seconde réaction passerait inaperçue.
 */
export function Reaction({ reaction }: { reaction: { emote: string; at: number } }) {
  return (
    <span
      key={reaction.at}
      aria-hidden
      // `no-underline` : le nom d'un joueur éliminé est barré, et la décoration se
      // transmet à ses descendants — sa réaction arrivait rayée.
      className="pb-emote pointer-events-none absolute -top-8 left-1/2 text-2xl no-underline"
      // La durée vit dans le moteur, avec le délai d'effacement de la bulle : écrite
      // aussi dans la feuille de style, elle s'en écarterait au premier réglage.
      style={{ animationDuration: `${EMOTE_TTL_MS}ms` }}
    >
      {reaction.emote}
    </span>
  )
}
