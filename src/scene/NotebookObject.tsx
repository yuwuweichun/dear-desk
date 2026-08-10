import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { Group } from 'three'
import { MathUtils } from 'three'

import type { NotebookPhase } from '../state/app-store'
import { RoundedBox } from './RoundedBox'
import { createSurfaceTexture, SCENE_PALETTE } from './scene-visuals'
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
  const clothTexture = useMemo(() => createSurfaceTexture('cloth'), [])
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

  useEffect(() => () => clothTexture.dispose(), [clothTexture])

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
      <RoundedBox size={[3.2, 0.17, 3.82]} radius={0.14} segments={4} castShadow receiveShadow>
        <meshStandardMaterial map={clothTexture} roughness={0.91} />
      </RoundedBox>
      <RoundedBox
        size={[3.02, 0.13, 3.62]}
        radius={0.1}
        position={[0.04, 0.135, 0]}
        castShadow
        receiveShadow
      >
        <meshStandardMaterial color={SCENE_PALETTE.paperEdge} roughness={0.96} />
      </RoundedBox>
      <RoundedBox
        size={[2.9, 0.055, 3.54]}
        radius={0.08}
        position={[0.08, 0.225, 0]}
        castShadow
      >
        <meshStandardMaterial color={SCENE_PALETTE.paper} roughness={0.98} />
      </RoundedBox>
      <RoundedBox size={[0.16, 0.15, 3.56]} radius={0.06} position={[-1.48, 0.255, 0]} castShadow>
        <meshStandardMaterial color={SCENE_PALETTE.clothDark} roughness={0.84} />
      </RoundedBox>
      <mesh position={[0.08, 0.27, 0.92]} castShadow>
        <boxGeometry args={[0.1, 0.025, 2.2]} />
        <meshStandardMaterial color={SCENE_PALETTE.burgundy} roughness={0.78} />
      </mesh>
      {pageLines.map((z) => (
        <mesh key={z} position={[0.08, 0.26, z]}>
          <boxGeometry args={[1.82, 0.012, 0.025]} />
          <meshStandardMaterial color="#cbbda6" roughness={1} />
        </mesh>
      ))}
      <mesh position={[-1.08, 0.26, 0]}>
        <boxGeometry args={[0.025, 0.012, 2.55]} />
        <meshStandardMaterial color="#c9827e" roughness={1} />
      </mesh>
      <group ref={cover} position={[-1.5, 0.3, 0]}>
        <RoundedBox
          size={[3.12, 0.13, 3.76]}
          radius={0.14}
          segments={4}
          position={[1.5, 0, 0]}
          castShadow
          receiveShadow
        >
          <meshStandardMaterial map={clothTexture} roughness={0.89} />
        </RoundedBox>
        <RoundedBox size={[2.8, 0.018, 3.44]} radius={0.1} position={[1.5, 0.075, 0]}>
          <meshStandardMaterial color={SCENE_PALETTE.clothDark} roughness={0.94} />
        </RoundedBox>
        <RoundedBox
          size={[2.82, 0.026, 3.46]}
          radius={0.08}
          position={[1.5, -0.082, 0]}
          castShadow
          receiveShadow
        >
          <meshStandardMaterial color={SCENE_PALETTE.paper} roughness={0.98} />
        </RoundedBox>
        <RoundedBox size={[1.12, 0.038, 0.62]} radius={0.06} position={[1.5, 0.098, 0.15]} castShadow>
          <meshStandardMaterial
            color={SCENE_PALETTE.brass}
            metalness={0.48}
            roughness={0.52}
          />
        </RoundedBox>
        <RoundedBox size={[0.72, 0.018, 0.25]} radius={0.03} position={[1.5, 0.122, 0.15]}>
          <meshStandardMaterial color={SCENE_PALETTE.brassDark} roughness={0.68} />
        </RoundedBox>
        {[-1.36, 1.36].map((z) => (
          <RoundedBox
            key={z}
            size={[2.48, 0.016, 0.035]}
            radius={0.012}
            position={[1.5, 0.094, z]}
          >
            <meshStandardMaterial color="#60746a" roughness={0.92} />
          </RoundedBox>
        ))}
      </group>
    </group>
  )
}
