/**
 * Générateur pseudo-aléatoire déterministe (mulberry32).
 *
 * Volontairement sans état interne : chaque appel reçoit une graine et renvoie la
 * suivante. Le moteur transporte donc son aléatoire dans l'état lui-même, ce qui rend
 * les parties reproductibles — indispensable pour tester les règles et pour simuler
 * des milliers de parties d'équilibrage.
 */

/** Renvoie [graine suivante, valeur dans [0, 1)]. */
export function nextFloat(seed: number): [number, number] {
  const a = (seed + 0x6d2b79f5) | 0
  let t = Math.imul(a ^ (a >>> 15), 1 | a)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return [a, ((t ^ (t >>> 14)) >>> 0) / 4294967296]
}

/** Renvoie [graine suivante, entier dans [0, maxExclusive)]. */
export function nextInt(seed: number, maxExclusive: number): [number, number] {
  const [next, value] = nextFloat(seed)
  return [next, Math.min(maxExclusive - 1, Math.floor(value * maxExclusive))]
}
