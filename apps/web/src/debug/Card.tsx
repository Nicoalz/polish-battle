import { isCursed, isDamaged, isHiddenCard, type Card } from '@pb/engine'
import { useI18n } from '../i18n'

const ROLE_STYLE = {
  life: 'ring-rose-500/70 bg-rose-500/15',
  shield: 'ring-sky-500/70 bg-sky-500/15',
  battery: 'ring-amber-400/70 bg-amber-400/15',
  drawn: 'ring-emerald-400/70 bg-emerald-400/15',
} as const

const ROLE_MARK = { life: '❤', shield: '🛡', battery: '⚡', drawn: '✦' } as const

/**
 * Carte de l'interface de debug : lisible, pas jolie.
 * Le vrai rendu est dans la scène 3D.
 */
export function CardView({ card, role }: { card: Card; role: keyof typeof ROLE_STYLE }) {
  const t = useI18n((state) => state.t)
  // Les cartes secrètes — charge posée, pioche d'un autre joueur — ne sont pas
  // transmises : on affiche leur absence, pas un zéro trompeur.
  const hidden = role === 'battery' || isHiddenCard(card)
  const cursed = !hidden && isCursed(card)

  return (
    <span
      title={cursed ? t.table.cursedCard : undefined}
      className={`inline-flex min-w-11 flex-col items-center rounded-md px-2 py-1 ring-1 ${
        cursed ? 'bg-black/60 ring-rose-600/80' : ROLE_STYLE[role]
      }`}
    >
      <span
        className={`text-lg leading-none font-bold tabular-nums ${cursed ? 'text-rose-400' : ''}`}
      >
        {hidden ? '?' : card.value}
      </span>
      <span className="text-[10px] leading-none opacity-60">
        {cursed ? '✦' : ROLE_MARK[role]}
        {!cursed && role === 'life' && isDamaged(card) && (
          <span className="ml-0.5 line-through">{card.rank}</span>
        )}
      </span>
    </span>
  )
}
