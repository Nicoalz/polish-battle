import { useEffect, useState } from 'react'

/**
 * Vrai sur les écrans étroits : téléphone en portrait, fenêtre réduite.
 *
 * Sert à la fois à la disposition de l'interface et au niveau de détail de la scène :
 * un téléphone n'a ni la place ni la puissance d'un écran de bureau.
 */
export function useIsCompact(): boolean {
  const [compact, setCompact] = useState(() => window.matchMedia('(max-width: 768px)').matches)

  useEffect(() => {
    const query = window.matchMedia('(max-width: 768px)')
    const onChange = (event: MediaQueryListEvent) => setCompact(event.matches)
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [])

  return compact
}
