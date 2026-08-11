import { useFrame, useThree } from '@react-three/fiber'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { Group } from 'three'
import { MathUtils } from 'three'

import type { NotebookPhase } from '../state/app-store'
import {
  createNotebookModel,
  type NotebookModelNodes,
} from './models/create-notebook-model'
import type { ModelMaterialLibrary } from './models/material-library'
import { NOTEBOOK_MODEL_SPEC } from './models/model-specs'
import { getSculptRuntime } from './models/model-types'
import {
  easeInOutCubic,
  getNotebookTransitionDuration,
  isNotebookModelVisible,
} from './notebook-transition'

interface NotebookObjectProps {
  materials: ModelMaterialLibrary
  notebookPhase: NotebookPhase
  onAdvance: (from: NotebookPhase) => void
  onOpen: () => void
  reducedMotion: boolean
}

const OPEN_ANGLE = NOTEBOOK_MODEL_SPEC.openAngle

export function NotebookObject({
  materials,
  notebookPhase,
  onAdvance,
  onOpen,
  reducedMotion,
}: NotebookObjectProps) {
  const { size } = useThree()
  const [model, setModel] = useState<Group | null>(null)
  const runtime = model
    ? getSculptRuntime<NotebookModelNodes>(model)
    : null
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
    const nextModel = createNotebookModel(materials, {
      pass: 'optimization-pass',
    })
    let disposed = false
    queueMicrotask(() => {
      if (!disposed) setModel(nextModel)
    })

    return () => {
      disposed = true
      const dispose = nextModel.userData.dispose
      if (typeof dispose === 'function') dispose()
    }
  }, [materials])

  const setOpenProgress = useCallback((progress: number) => {
    if (!model) return
    const update = model.userData.setOpenProgress
    if (typeof update === 'function') update(progress)
  }, [model])

  useEffect(() => {
    if (!hovered) return
    document.body.style.cursor = 'pointer'
    return () => {
      document.body.style.cursor = ''
    }
  }, [hovered])

  useEffect(() => {
    if (!runtime) return
    if (notebookPhase === 'desk' || notebookPhase === 'retreating') {
      motion.current = null
      setOpenProgress(0)
      return
    }
    if (notebookPhase === 'editing' || notebookPhase === 'approaching') {
      motion.current = null
      setOpenProgress(notebookPhase === 'editing' ? 1 : 0)
      return
    }
    if (notebookPhase === 'opening' || notebookPhase === 'closing') {
      motion.current = {
        from: runtime.nodes.coverPivot.rotation.z / OPEN_ANGLE,
        phase: notebookPhase,
        startedAt: performance.now(),
        to: notebookPhase === 'opening' ? 1 : 0,
      }
    }
  }, [notebookPhase, runtime, setOpenProgress])

  useFrame((_state, delta) => {
    if (!group.current || !model) return
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
    setOpenProgress(MathUtils.lerp(active.from, active.to, progress))

    if (elapsed >= duration) {
      motion.current = null
      onAdvance(active.phase)
    }
  })

  if (!model) return null

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
      <primitive
        object={model}
        dispose={null}
        visible={isNotebookModelVisible(notebookPhase)}
      />
    </group>
  )
}
