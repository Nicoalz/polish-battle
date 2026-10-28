import { useEffect, type Dispatch, type RefObject, type SetStateAction } from 'react'

/**
 * Ferme un panneau au clic extérieur et à Échap.
 *
 * Deux panneaux se posent par-dessus la table — les réglages et les réactions — et un
 * panneau resté ouvert masque le jeu. La règle est la même pour les deux ; elle n'a
 * donc pas à être écrite deux fois.
 *
 * On prend le `setState` plutôt qu'une fonction de fermeture : il garde la même
 * identité d'un rendu à l'autre, là où une flèche anonyme ferait et déferait les
 * écouteurs à chaque image.
 */
export function useDismiss(
  open: boolean,
  root: RefObject<HTMLElement | null>,
  setOpen: Dispatch<SetStateAction<boolean>>,
): void {
  useEffect(() => {
    if (!open) return
    const onPointer = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && setOpen(false)
    document.addEventListener('pointerdown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open, root, setOpen])
}
