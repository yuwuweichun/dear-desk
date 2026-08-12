import { useFrame, useThree } from '@react-three/fiber'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { Group } from 'three'
import { MathUtils } from 'three'

import type { DeskCameraPreset, NotebookPhase } from '../state/app-store'
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
  deskCameraPreset: DeskCameraPreset
  materials: ModelMaterialLibrary
  notebookPhase: NotebookPhase
  onAdvance: (from: NotebookPhase) => void
  onOpen: () => void
  reducedMotion: boolean
}

const OPEN_ANGLE = NOTEBOOK_MODEL_SPEC.openAngle
const MOBILE_NOTEBOOK_X = NOTEBOOK_MODEL_SPEC.rootPosition[0] - 1.7
const MOBILE_NOTEBOOK_Z = NOTEBOOK_MODEL_SPEC.rootPosition[2] - 3.3

export function NotebookObject({
  deskCameraPreset,
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
  const useMobileOverviewPosition =
    size.width < 700 && notebookPhase === 'desk' && deskCameraPreset !== 'near'
  const notebookPosition = useMobileOverviewPosition
    ? [
        MOBILE_NOTEBOOK_X,
        NOTEBOOK_MODEL_SPEC.rootPosition[1],
        MOBILE_NOTEBOOK_Z,
      ] as const
    : NOTEBOOK_MODEL_SPEC.rootPosition

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

  const setOpenProgress = useCallback((
    progress: number,
    animateRapidPages = false,
  ) => {
    if (!model) return
    const update = model.userData.setOpenProgress
    if (typeof update === 'function') update(progress, animateRapidPages)
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
      const readProgress = model?.userData.getOpenProgress
      motion.current = {
        from: typeof readProgress === 'function'
          ? readProgress()
          : runtime.nodes.coverPivot.rotation.z / OPEN_ANGLE,
        phase: notebookPhase,
        startedAt: performance.now(),
        to: notebookPhase === 'opening' ? 1 : 0,
      }
    }
  }, [model, notebookPhase, runtime, setOpenProgress])

  useFrame((_state, delta) => {
    if (!group.current || !model) return
    const targetY = hovered && interactive ? 0.46 : 0.34
    group.current.position.y = MathUtils.damp(
      group.current.position.y,
      targetY,
      8,
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
    const elapsedProgress = elapsed / duration
    const progress = active.phase === 'opening' && !reducedMotion
      ? elapsedProgress
      : easeInOutCubic(elapsedProgress)
    setOpenProgress(
      MathUtils.lerp(active.from, active.to, progress),
      active.phase === 'opening' && !reducedMotion,
    )

    if (elapsed >= duration) {
      motion.current = null
      onAdvance(active.phase)
    }
  })

  if (!model) return null

  return (
    <group
      ref={group}
      position={notebookPosition}
      rotation={NOTEBOOK_MODEL_SPEC.deskRotation}
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
        <boxGeometry
          args={[
            NOTEBOOK_MODEL_SPEC.cover.width,
            0.12,
            NOTEBOOK_MODEL_SPEC.cover.depth,
          ]}
        />
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
