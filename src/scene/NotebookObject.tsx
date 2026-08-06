import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useRef, useState } from 'react'
import type { Group } from 'three'
import { MathUtils } from 'three'

import type { NotebookPhase } from '../state/app-store'
import {
  easeInOutCubic,
  getNotebookTransitionDuration,
} from './notebook-transition'

interface NotebookObjectProps {
  notebookPhase: NotebookPhase
  onAdvance: (from: NotebookPhase) => void
  onOpen: () => void
  reducedMotion: boolean
}

const pageLines = [-1.03, -0.72, -0.41, -0.1, 0.21, 0.52]
const OPEN_ANGLE = Math.PI * 0.97

export function NotebookObject({
  notebookPhase,
  onAdvance,
  onOpen,
  reducedMotion,
}: NotebookObjectProps) {
  const { size } = useThree()
  const cover = useRef<Group>(null)
  const group = useRef<Group>(null)
  const [hovered, setHovered] = useState(false)
  const motion = useRef<{
    from: number
    phase: 'opening' | 'closing'
    startedAt: number
    to: number
  } | null>(null)

  const interactive = notebookPhase === 'desk'

  useEffect(() => {
    if (!hovered) return
    document.body.style.cursor = 'pointer'
    return () => {
      document.body.style.cursor = ''
    }
  }, [hovered])

  useEffect(() => {
    if (!cover.current) return
    if (notebookPhase === 'desk' || notebookPhase === 'retreating') {
      motion.current = null
      cover.current.rotation.z = 0
      return
    }
    if (notebookPhase === 'editing' || notebookPhase === 'approaching') {
      motion.current = null
      cover.current.rotation.z = notebookPhase === 'editing' ? OPEN_ANGLE : 0
      return
    }
    if (notebookPhase === 'opening' || notebookPhase === 'closing') {
      motion.current = {
        from: cover.current.rotation.z,
        phase: notebookPhase,
        startedAt: performance.now(),
        to: notebookPhase === 'opening' ? OPEN_ANGLE : 0,
      }
    }
  }, [notebookPhase])

  useFrame((_state, delta) => {
    if (!group.current || !cover.current) return
    const targetY = hovered && interactive ? 0.43 : 0.34
    group.current.position.y = MathUtils.damp(
      group.current.position.y,
      targetY,
      8,
      delta,
    )
    group.current.rotation.z = MathUtils.damp(
      group.current.rotation.z,
      notebookPhase === 'desk' ? -0.12 : -0.02,
      7,
      delta,
    )

    const active = motion.current
    if (!active || active.phase !== notebookPhase) return
    const duration = getNotebookTransitionDuration(
      active.phase,
      reducedMotion,
      size.width < 700,
    )
    const elapsed = Math.min(
      (performance.now() - active.startedAt) / 1000,
      duration,
    )
    const progress = easeInOutCubic(elapsed / duration)
    cover.current.rotation.z = MathUtils.lerp(active.from, active.to, progress)

    if (elapsed >= duration) {
      motion.current = null
      onAdvance(active.phase)
    }
  })

  return (
    <group
      ref={group}
      position={[-0.65, 0.34, 0.25]}
      rotation={[0, -0.16, -0.12]}
    >
      <mesh
        position={[0, 0.38, 0]}
        onClick={(event) => {
          event.stopPropagation()
          if (interactive) onOpen()
        }}
        onPointerOver={(event) => {
          event.stopPropagation()
          if (interactive) setHovered(true)
        }}
        onPointerOut={() => setHovered(false)}
      >
        <boxGeometry args={[3.18, 0.12, 3.82]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[3.2, 0.16, 3.82]} />
        <meshStandardMaterial color="#9f3940" roughness={0.72} />
      </mesh>
      <mesh position={[0.04, 0.125, 0]} castShadow receiveShadow>
        <boxGeometry args={[3.02, 0.1, 3.62]} />
        <meshStandardMaterial color="#eee3cb" roughness={0.9} />
      </mesh>
      <mesh position={[0.08, 0.195, 0]} castShadow>
        <boxGeometry args={[2.9, 0.05, 3.54]} />
        <meshStandardMaterial color="#f7eedb" roughness={0.96} />
      </mesh>
      <mesh position={[-1.48, 0.24, 0]} castShadow>
        <boxGeometry args={[0.12, 0.12, 3.5]} />
        <meshStandardMaterial color="#2a2824" metalness={0.2} roughness={0.5} />
      </mesh>
      <mesh position={[0.88, 0.245, 0]} castShadow>
        <boxGeometry args={[0.08, 0.08, 3.54]} />
        <meshStandardMaterial color="#d8a358" roughness={0.52} />
      </mesh>
      {pageLines.map((z) => (
        <mesh key={z} position={[0.08, 0.225, z]}>
          <boxGeometry args={[1.82, 0.012, 0.025]} />
          <meshStandardMaterial color="#c5bca8" roughness={1} />
        </mesh>
      ))}
      <mesh position={[-1.08, 0.225, 0]}>
        <boxGeometry args={[0.025, 0.012, 2.55]} />
        <meshStandardMaterial color="#d99a93" roughness={1} />
      </mesh>
      <group ref={cover} position={[-1.5, 0.3, 0]}>
        <mesh position={[1.5, 0, 0]} castShadow receiveShadow>
          <boxGeometry args={[3.12, 0.12, 3.76]} />
          <meshStandardMaterial color="#aa3f46" roughness={0.68} />
        </mesh>
        <mesh position={[1.5, 0.066, 0]}>
          <boxGeometry args={[2.78, 0.02, 3.42]} />
          <meshStandardMaterial color="#8e3037" roughness={0.82} />
        </mesh>
        <mesh position={[1.5, 0.082, 0.15]}>
          <boxGeometry args={[1.24, 0.025, 0.72]} />
          <meshStandardMaterial color="#d9b46f" roughness={0.72} />
        </mesh>
      </group>
    </group>
  )
}
