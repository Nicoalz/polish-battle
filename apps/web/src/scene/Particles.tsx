import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useStage } from './stage'
import { useSettings } from '../settings'

const COUNT = 180

/**
 * Éclats en suspension au-dessus de la table.
 *
 * Un seul maillage instancié, animé sur le processeur : à cette quantité c'est sans
 * incidence, et ça suffit à donner de l'air à la scène entre deux coups.
 */
export function Particles({ color }: { color: string }) {
  const points = useRef<THREE.Points>(null)
  const reducedMotion = useSettings((state) => state.reducedMotion)

  const { geometry, speeds } = useMemo(() => {
    const positions = new Float32Array(COUNT * 3)
    const drift = new Float32Array(COUNT)
    for (let i = 0; i < COUNT; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 16
      positions[i * 3 + 1] = Math.random() * 6
      positions[i * 3 + 2] = (Math.random() - 0.5) * 12
      drift[i] = 0.12 + Math.random() * 0.3
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    return { geometry: geo, speeds: drift }
  }, [])

  useFrame((_, delta) => {
    if (reducedMotion || !points.current) return
    const attribute = points.current.geometry.attributes.position as THREE.BufferAttribute
    const array = attribute.array as Float32Array
    for (let i = 0; i < COUNT; i++) {
      const y = i * 3 + 1
      array[y] = (array[y] ?? 0) + (speeds[i] ?? 0.2) * delta
      if ((array[y] ?? 0) > 6) array[y] = 0
    }
    attribute.needsUpdate = true
  })

  return (
    <points ref={points} geometry={geometry}>
      <pointsMaterial
        size={0.055}
        color={color}
        transparent
        opacity={0.45}
        sizeAttenuation
        depthWrite={false}
        toneMapped={false}
      />
    </points>
  )
}
