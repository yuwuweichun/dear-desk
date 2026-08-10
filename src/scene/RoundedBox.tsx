import type { ThreeElements } from '@react-three/fiber'
import { useEffect, useMemo, type ReactNode } from 'react'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'

interface RoundedBoxProps extends Omit<ThreeElements['mesh'], 'children'> {
  children: ReactNode
  radius?: number
  segments?: number
  size: [number, number, number]
}

export function RoundedBox({
  children,
  radius = 0.1,
  segments = 3,
  size,
  ...meshProps
}: RoundedBoxProps) {
  const [width, height, depth] = size
  const geometry = useMemo(
    () => new RoundedBoxGeometry(width, height, depth, segments, radius),
    [depth, height, radius, segments, width],
  )

  useEffect(() => () => geometry.dispose(), [geometry])

  return (
    <mesh {...meshProps}>
      <primitive attach="geometry" object={geometry} />
      {children}
    </mesh>
  )
}
