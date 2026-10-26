import { useId } from 'react'
import { findAvatar, type Avatar as Face, type HairStyle } from '@pb/engine'

/**
 * Le portrait d'un joueur, dessiné et non chargé.
 *
 * Même parti pris que les cartes et les bruitages : tout est produit à l'exécution, donc
 * aucun fichier à héberger, aucune requête au premier affichage, et un rendu net au pixel
 * aussi bien dans la grille de choix qu'à seize pixels sur une plaque de nom.
 *
 * Le dessin est volontairement sommaire — une silhouette de coupe, deux yeux, une bouche.
 * C'est la contrainte des plaques de nom qui commande : à cette taille, un visage détaillé
 * devient une tache, alors qu'une silhouette franche reste reconnaissable.
 */

/** Repères du visage, dans un carré de 64. Tout le reste s'y accroche. */
const HEAD = { cx: 32, cy: 28, rx: 13, ry: 14.5 }
const EYE = '#2a1a12'

export function Avatar({
  id,
  size = 24,
  className,
}: {
  id: string
  size?: number
  className?: string
}) {
  const face = findAvatar(id)
  // Deux portraits coexistent toujours à l'écran : un identifiant fixe ferait que le
  // premier détourage s'applique à tous.
  const clip = useId()

  return (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      className={className}
      aria-hidden
      focusable="false"
    >
      <defs>
        <clipPath id={clip}>
          <circle cx="32" cy="32" r="32" />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clip})`}>
        <circle cx="32" cy="32" r="32" fill={face.backdrop} />
        <HairBack face={face} />
        {/* Les épaules passent devant les mèches : c'est ce qui place les cheveux
            dans le dos plutôt que posés sur le vêtement. */}
        <path d="M6 64c0-12 11-19 26-19s26 7 26 19z" fill={face.outfit} />
        <rect x="27" y="36" width="10" height="11" rx="4.5" fill={face.skin} />
        <circle cx="19" cy="30" r="3" fill={face.skin} />
        <circle cx="45" cy="30" r="3" fill={face.skin} />
        <ellipse cx={HEAD.cx} cy={HEAD.cy} rx={HEAD.rx} ry={HEAD.ry} fill={face.skin} />
        <Beard face={face} />
        <HairFront face={face} />
        <Features face={face} />
      </g>
    </svg>
  )
}

/** Yeux, sourcils, bouche — posés en dernier pour rester lisibles par-dessus tout. */
function Features({ face }: { face: Face }) {
  const covered = face.hair === 'scarf'
  return (
    <>
      <ellipse cx="26.6" cy="28.5" rx="1.7" ry="2.2" fill={EYE} />
      <ellipse cx="37.4" cy="28.5" rx="1.7" ry="2.2" fill={EYE} />
      <path
        d="M23.3 23.4q3.3-1.7 6.6 0M34.1 23.4q3.3-1.7 6.6 0"
        stroke={covered ? EYE : face.hairColor}
        strokeWidth="1.7"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M28.6 35.4q3.4 2.7 6.8 0"
        stroke="#8a4a3a"
        strokeWidth="1.7"
        strokeLinecap="round"
        fill="none"
      />
    </>
  )
}

/** Barbe pleine ou naissante : la même forme, l'opacité en moins. */
function Beard({ face }: { face: Face }) {
  if (!face.beard) return null
  return (
    <path
      d="M19.3 25c-.3 10 4.7 17.5 12.7 17.5s13-7.5 12.7-17.5c-.7 6-5.7 7.5-12.7 7.5s-12-1.5-12.7-7.5z"
      fill={face.hairColor}
      fillOpacity={face.beard === 'full' ? 1 : 0.38}
    />
  )
}

/**
 * Ce qui pend derrière la tête.
 *
 * Dessiné avant le crâne et avant les épaules : une mèche longue passe donc sous le
 * visage et sous le vêtement, ce qui suffit à donner la profondeur sans découpe.
 */
function HairBack({ face }: { face: Face }) {
  const fill = face.hairColor
  switch (face.hair) {
    case 'waves':
      return (
        <path
          d="M13 50c-3-17 0-31 8-36h22c8 5 11 19 8 36-4-8-4-20-7-28H20c-3 8-3 20-7 28z"
          fill={fill}
        />
      )
    case 'long':
      return (
        <path d="M13 64c-2-26-1-44 9-50h20c10 6 11 24 9 50h-6c1-22 1-38-1-44H20c-2 6-2 22-1 44z" fill={fill} />
      )
    case 'bob':
      return (
        <path
          d="M15 42c-2-15 0-25 7-29h20c7 4 9 14 7 29-2 3-5 4-7 1 2-9 2-17 0-22H22c-2 5-2 13 0 22-2 3-5 2-7-1z"
          fill={fill}
        />
      )
    case 'bun':
      return <circle cx="32" cy="8" r="6" fill={fill} />
    case 'ponytail':
      return (
        <>
          <path d="M43 17c9 4 12 17 7 29-3-4-5-13-9-22z" fill={fill} />
          <circle cx="43.5" cy="18" r="3" fill={fill} />
        </>
      )
    case 'locs':
      // Les deux mèches extérieures tombent derrière ; les deux autres reviennent devant,
      // dans `HairFront`, pour encadrer le visage sans jamais atteindre les yeux.
      return <Locs fill={fill} strands={[13.6, 45.8]} />
    default:
      return null
  }
}

/** Le crâne : la coupe à proprement parler, posée par-dessus le visage. */
function HairFront({ face }: { face: Face }) {
  const fill = face.hairColor

  switch (face.hair) {
    case 'bald':
      // Pas de cheveux, mais un reflet : sans lui, le haut du crâne paraît plat.
      return <ellipse cx="27" cy="18" rx="5.5" ry="3" fill="#ffffff" fillOpacity="0.14" />

    case 'buzz':
      return <path d="M19 28c0-12 5.5-15 13-15s13 3 13 15c-1.4-6-6-8-13-8s-11.6 2-13 8z" fill={fill} />

    case 'short':
      return (
        <path
          d="M19 29c-.5-13.5 5-17 13-17s13.5 3.5 13 17c-1.1-6.6-3-9.4-6.2-10.2-4 3-11.8 3.4-16.4 1-1.5 2.3-2.6 5.3-3.4 9.2z"
          fill={fill}
        />
      )

    case 'curls':
      return (
        <>
          <path d="M19 26c0-10 5-14 13-14s13 4 13 14z" fill={fill} />
          <circle cx="32" cy="13.5" r="8.5" fill={fill} />
          <circle cx="23" cy="17" r="7" fill={fill} />
          <circle cx="41" cy="17" r="7" fill={fill} />
          <circle cx="19.5" cy="23" r="5.5" fill={fill} />
          <circle cx="44.5" cy="23" r="5.5" fill={fill} />
        </>
      )

    case 'afro':
      return (
        <>
          <circle cx="32" cy="11" r="11" fill={fill} />
          <circle cx="20" cy="17" r="9" fill={fill} />
          <circle cx="44" cy="17" r="9" fill={fill} />
          <circle cx="16.5" cy="26" r="6.5" fill={fill} />
          <circle cx="47.5" cy="26" r="6.5" fill={fill} />
        </>
      )

    case 'bob':
      return <path d="M19 27c0-13 5.5-16 13-16s13 3 13 16v-5H19z" fill={fill} />

    case 'locs':
      return (
        <>
          {/* Coupe débordante : c'est elle qui donne aux mèches un point d'attache. */}
          <path d="M16 30c-1-16 6.5-20 16-20s17 4 16 20c-2-8-7.5-11.5-16-11.5S18 22 16 30z" fill={fill} />
          <Locs fill={fill} strands={[18.4, 41]} />
        </>
      )

    case 'bun':
    case 'ponytail':
      // Cheveux tirés en arrière : la racine colle au crâne, le volume est derrière.
      return <path d="M19 27c0-12 5.5-15.5 13-15.5S45 15 45 27c-1-7-6-9.5-13-9.5S20 20 19 27z" fill={fill} />

    case 'scarf':
      // Le tissu est percé du visage : une seule forme, trouée en « pair-impair », pour
      // qu'il encadre la tête au lieu de passer derrière ou devant d'un bloc.
      return (
        <path
          d="M32 9c13 0 16 12 16 22 0 11-4 19-8 23H24c-4-4-8-12-8-23C16 21 19 9 32 9zM43.5 28.5a11.5 13.5 0 1 0-23 0 11.5 13.5 0 1 0 23 0z"
          fillRule="evenodd"
          fill={fill}
        />
      )

    default:
      // Coupe pleine : le même crâne pour les mèches longues, ondulées ou lisses.
      return <path d="M19 28c-.5-13 5-16.5 13-16.5S45.5 15 45 28c-1.5-7-6-9.5-13-9.5S20.5 21 19 28z" fill={fill} />
  }
}

/** Mèches pendantes, aux longueurs légèrement inégales — sinon elles font grille. */
function Locs({ fill, strands }: { fill: string; strands: number[] }) {
  return (
    <>
      {strands.map((x, index) => (
        <rect
          key={x}
          x={x}
          y="19"
          width="4.6"
          height={index % 2 === 0 ? 27 : 24}
          rx="2.3"
          fill={fill}
        />
      ))}
    </>
  )
}

export type { HairStyle }
