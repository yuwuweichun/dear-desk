import { createRoot, events, extend, useFrame, useThree } from '@react-three/fiber'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { ReconcilerRoot } from '@react-three/fiber'
import * as THREE from 'three'

import type { PlacedSticker, StickerPosition } from '../domain/sticker'
import { useAppStore } from '../state/app-store-context'
import type { NotebookPhase, StickerWorkflow } from '../state/app-store'
import { NotebookObject } from './NotebookObject'
import { createDeskMatModel } from './models/create-desk-mat-model'
import { createDeskModel } from './models/create-desk-model'
import {
  createModelMaterialLibrary,
  SCENE_PALETTE,
  type ModelMaterialLibrary,
} from './models/material-library'
import { DESK_MAT_MODEL_SPEC } from './models/model-specs'
import { SceneEnvironment } from './models/SceneEnvironment'
import { StickerObject } from './StickerObject'
import {
  easeInOutCubic,
  getNotebookTransitionDuration,
  type AnimatedNotebookPhase,
} from './notebook-transition'

extend({
  AmbientLight: THREE.AmbientLight,
  BoxGeometry: THREE.BoxGeometry,
  Color: THREE.Color,
  CylinderGeometry: THREE.CylinderGeometry,
  DirectionalLight: THREE.DirectionalLight,
  Fog: THREE.Fog,
  Group: THREE.Group,
  HemisphereLight: THREE.HemisphereLight,
  Mesh: THREE.Mesh,
  MeshBasicMaterial: THREE.MeshBasicMaterial,
  MeshStandardMaterial: THREE.MeshStandardMaterial,
  PlaneGeometry: THREE.PlaneGeometry,
})

interface ManagedRoot {
  disposeTimer: number | null
  root: ReconcilerRoot<HTMLCanvasElement>
  users: number
}

const managedRoots = new WeakMap<HTMLCanvasElement, ManagedRoot>()

const acquireRoot = (canvas: HTMLCanvasElement) => {
  const existing = managedRoots.get(canvas)
  if (existing) {
    if (existing.disposeTimer !== null) window.clearTimeout(existing.disposeTimer)
    existing.disposeTimer = null
    existing.users += 1
    return existing.root
  }

  const managed: ManagedRoot = {
    disposeTimer: null,
    root: createRoot(canvas),
    users: 1,
  }
  managedRoots.set(canvas, managed)
  return managed.root
}

const releaseRoot = (canvas: HTMLCanvasElement) => {
  const managed = managedRoots.get(canvas)
  if (!managed) return
  managed.users -= 1
  if (managed.users > 0) return

  managed.disposeTimer = window.setTimeout(() => {
    if (managed.users > 0) return
    managed.root.unmount()
    managedRoots.delete(canvas)
  }, 0)
}

interface CameraPose {
  fov: number
  position: THREE.Vector3
  target: THREE.Vector3
}

const cameraPose = (
  position: [number, number, number],
  target: [number, number, number],
  fov: number,
): CameraPose => ({
  fov,
  position: new THREE.Vector3(...position),
  target: new THREE.Vector3(...target),
})

const getCameraPoses = (mobile: boolean) => ({
  desk: mobile
    ? cameraPose([6.7, 7.7, 11.5], [0, -0.45, 0.15], 37)
    : cameraPose([8.9, 5.7, 11.3], [0, -0.9, 0.2], 35),
  focus: mobile
    ? cameraPose([0.1, 10.6, 6.2], [-2.05, 0.22, 0.25], 39)
    : cameraPose([0.2, 8.6, 5.1], [-2.05, 0.22, 0.25], 33),
})

const quaternionForPose = (pose: CameraPose) => {
  const poseCamera = new THREE.PerspectiveCamera()
  poseCamera.position.copy(pose.position)
  poseCamera.lookAt(pose.target)
  return poseCamera.quaternion.clone()
}

const applyCameraPose = (camera: THREE.PerspectiveCamera, pose: CameraPose) => {
  camera.position.copy(pose.position)
  camera.quaternion.copy(quaternionForPose(pose))
  camera.fov = pose.fov
  camera.updateProjectionMatrix()
  camera.updateMatrixWorld(true)
}

interface CameraRigProps {
  notebookPhase: NotebookPhase
  onAdvance: (from: NotebookPhase) => void
  reducedMotion: boolean
}

function CameraRig({ notebookPhase, onAdvance, reducedMotion }: CameraRigProps) {
  const { camera, size } = useThree()
  const transition = useRef<{
    fromFov: number
    fromPosition: THREE.Vector3
    fromQuaternion: THREE.Quaternion
    phase: AnimatedNotebookPhase
    startedAt: number
    toPose: CameraPose
    toQuaternion: THREE.Quaternion
  } | null>(null)

  useEffect(() => {
    if (!(camera instanceof THREE.PerspectiveCamera)) return
    const poses = getCameraPoses(size.width < 700)

    if (notebookPhase === 'desk') {
      transition.current = null
      applyCameraPose(camera, poses.desk)
      return
    }
    if (notebookPhase === 'editing') {
      transition.current = null
      applyCameraPose(camera, poses.focus)
      return
    }
    if (notebookPhase === 'opening' || notebookPhase === 'closing') {
      transition.current = null
      applyCameraPose(camera, poses.focus)
      return
    }

    const toPose = notebookPhase === 'approaching' ? poses.focus : poses.desk
    transition.current = {
      fromFov: camera.fov,
      fromPosition: camera.position.clone(),
      fromQuaternion: camera.quaternion.clone(),
      phase: notebookPhase,
      startedAt: performance.now(),
      toPose,
      toQuaternion: quaternionForPose(toPose),
    }
  }, [camera, notebookPhase, size.width])

  useFrame((state) => {
    if (!(state.camera instanceof THREE.PerspectiveCamera)) return
    const frameCamera = state.camera
    const active = transition.current
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

    frameCamera.position.lerpVectors(
      active.fromPosition,
      active.toPose.position,
      progress,
    )
    frameCamera.quaternion.slerpQuaternions(
      active.fromQuaternion,
      active.toQuaternion,
      progress,
    )
    frameCamera.fov = THREE.MathUtils.lerp(
      active.fromFov,
      active.toPose.fov,
      progress,
    )
    frameCamera.updateProjectionMatrix()
    frameCamera.updateMatrixWorld(true)

    if (elapsed >= duration) {
      transition.current = null
      onAdvance(active.phase)
    }
  })

  return null
}

const disposeFactoryModel = (model: THREE.Group) => {
  const dispose = model.userData.dispose
  if (typeof dispose === 'function') dispose()
}

function DeskBody({ materials }: { materials: ModelMaterialLibrary }) {
  const [model, setModel] = useState<THREE.Group | null>(null)

  useEffect(() => {
    const nextModel = createDeskModel(materials, {
      pass: 'optimization-pass',
    })
    let disposed = false
    queueMicrotask(() => {
      if (!disposed) setModel(nextModel)
    })
    return () => {
      disposed = true
      disposeFactoryModel(nextModel)
    }
  }, [materials])

  return model ? <primitive object={model} dispose={null} /> : null
}

function DeskMat({ materials }: { materials: ModelMaterialLibrary }) {
  const [model, setModel] = useState<THREE.Group | null>(null)

  useEffect(() => {
    const nextModel = createDeskMatModel(materials, {
      pass: 'optimization-pass',
    })
    let disposed = false
    queueMicrotask(() => {
      if (!disposed) setModel(nextModel)
    })
    return () => {
      disposed = true
      disposeFactoryModel(nextModel)
    }
  }, [materials])

  return model ? <primitive object={model} dispose={null} /> : null
}

interface DeskContentsProps {
  advanceNotebookPhase: (from: NotebookPhase) => void
  commitStickerPosition: (
    instanceId: string,
    position: StickerPosition,
  ) => Promise<boolean>
  notebookPhase: NotebookPhase
  placePendingDeskSticker: (position: StickerPosition) => Promise<boolean>
  previewStickerPosition: (instanceId: string, position: StickerPosition) => void
  reducedMotion: boolean
  requestNotebookOpen: () => void
  selectSticker: (instanceId: string | null) => void
  selectedStickerId: string | null
  stickers: PlacedSticker[]
  stickerWorkflow: StickerWorkflow
}

function DeskContents({
  advanceNotebookPhase,
  commitStickerPosition,
  notebookPhase,
  placePendingDeskSticker,
  previewStickerPosition,
  reducedMotion,
  requestNotebookOpen,
  selectSticker,
  selectedStickerId,
  stickers,
  stickerWorkflow,
}: DeskContentsProps) {
  const [materials, setMaterials] = useState<ModelMaterialLibrary | null>(null)

  useEffect(() => {
    const nextMaterials = createModelMaterialLibrary()
    let disposed = false
    queueMicrotask(() => {
      if (!disposed) setMaterials(nextMaterials)
    })
    return () => {
      disposed = true
      nextMaterials.dispose()
    }
  }, [])

  if (!materials) {
    return (
      <>
        <color attach="background" args={[SCENE_PALETTE.background]} />
        <fog attach="fog" args={[SCENE_PALETTE.background, 25, 39]} />
      </>
    )
  }

  return (
    <>
      <color attach="background" args={[SCENE_PALETTE.background]} />
      <fog attach="fog" args={[SCENE_PALETTE.background, 25, 39]} />
      <hemisphereLight args={['#aeb8aa', '#07100b', 0.25]} />
      <directionalLight
        castShadow
        color="#ffdca8"
        intensity={2.25}
        position={[-5.5, 10.5, 7]}
        shadow-mapSize={[1536, 1536]}
        shadow-bias={-0.00016}
        shadow-normalBias={0.025}
        shadow-radius={2.2}
        shadow-camera-left={-9}
        shadow-camera-right={9}
        shadow-camera-top={9}
        shadow-camera-bottom={-9}
        shadow-camera-near={1}
        shadow-camera-far={24}
      />
      <directionalLight color="#9eb6a8" intensity={0.15} position={[7, 5, -6]} />
      <SceneEnvironment intensity={0.32} />
      <CameraRig
        notebookPhase={notebookPhase}
        onAdvance={advanceNotebookPhase}
        reducedMotion={reducedMotion}
      />

      <DeskBody materials={materials} />
      <mesh
        position={[0, -3.45, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
      >
        <planeGeometry args={[40, 40]} />
        <meshStandardMaterial color="#070d09" roughness={1} />
      </mesh>
      <DeskMat materials={materials} />
      <mesh
        name="desk-mat-hit-surface"
        position={[0, DESK_MAT_MODEL_SPEC.topY, 0.2]}
        rotation={[-Math.PI / 2, 0, 0]}
        onClick={(event) => {
          if (stickerWorkflow === 'placingDesk') {
            event.stopPropagation()
            void placePendingDeskSticker({ x: event.point.x, z: event.point.z })
            return
          }
          if (stickerWorkflow === 'idle') selectSticker(null)
        }}
        onPointerOver={() => {
          if (stickerWorkflow === 'placingDesk') document.body.style.cursor = 'crosshair'
        }}
        onPointerOut={() => {
          if (stickerWorkflow === 'placingDesk') document.body.style.cursor = ''
        }}
      >
        <planeGeometry args={[DESK_MAT_MODEL_SPEC.width, DESK_MAT_MODEL_SPEC.depth]} />
        <meshBasicMaterial
          colorWrite={false}
          depthWrite={false}
          opacity={0}
          transparent
        />
      </mesh>
      {stickers.map((sticker) => (
        <StickerObject
          key={sticker.instance.id}
          sticker={sticker}
          interactive={stickerWorkflow === 'idle' && notebookPhase === 'desk'}
          selected={selectedStickerId === sticker.instance.id}
          onSelect={selectSticker}
          onPreviewPosition={previewStickerPosition}
          onCommitPosition={(instanceId, position) => {
            void commitStickerPosition(instanceId, position)
          }}
        />
      ))}
      <NotebookObject
        materials={materials}
        notebookPhase={notebookPhase}
        onAdvance={advanceNotebookPhase}
        onOpen={requestNotebookOpen}
        reducedMotion={reducedMotion}
      />
    </>
  )
}

interface DeskSceneProps {
  fallback: ReactNode
}

export function DeskScene({ fallback }: DeskSceneProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rootRef = useRef<ReconcilerRoot<HTMLCanvasElement> | null>(null)
  const [unavailable, setUnavailable] = useState(false)
  const [reducedMotion, setReducedMotion] = useState(false)
  const advanceNotebookPhase = useAppStore((state) => state.advanceNotebookPhase)
  const commitStickerPosition = useAppStore(
    (state) => state.commitStickerPosition,
  )
  const notebookPhase = useAppStore((state) => state.notebookPhase)
  const placePendingDeskSticker = useAppStore((state) => state.placePendingDeskSticker)
  const previewStickerPosition = useAppStore(
    (state) => state.previewStickerPosition,
  )
  const requestNotebookOpen = useAppStore((state) => state.requestNotebookOpen)
  const selectSticker = useAppStore((state) => state.selectSticker)
  const selectedStickerId = useAppStore((state) => state.selectedStickerId)
  const stickers = useAppStore((state) => state.stickers)
  const stickerWorkflow = useAppStore((state) => state.stickerWorkflow)
  const latestSceneProps = useRef<DeskContentsProps>({
    advanceNotebookPhase,
    commitStickerPosition,
    notebookPhase,
    placePendingDeskSticker,
    previewStickerPosition,
    reducedMotion,
    requestNotebookOpen,
    selectSticker,
    selectedStickerId,
    stickers,
    stickerWorkflow,
  })

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const updatePreference = () => setReducedMotion(media.matches)
    updatePreference()
    media.addEventListener('change', updatePreference)
    return () => media.removeEventListener('change', updatePreference)
  }, [])

  useEffect(() => {
    if (
      notebookPhase !== 'approaching' &&
      notebookPhase !== 'opening' &&
      notebookPhase !== 'closing' &&
      notebookPhase !== 'retreating'
    ) {
      return
    }

    if (reducedMotion) {
      advanceNotebookPhase(notebookPhase)
      return
    }

    const timer = window.setTimeout(
      () => advanceNotebookPhase(notebookPhase),
      getNotebookTransitionDuration(
        notebookPhase,
        reducedMotion,
        window.innerWidth < 700,
      ) * 1000,
    )
    return () => window.clearTimeout(timer)
  }, [advanceNotebookPhase, notebookPhase, reducedMotion])

  useEffect(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return

    const root = acquireRoot(canvas)
    rootRef.current = root
    let disposed = false

    const configure = async () => {
      const rect = container.getBoundingClientRect()
      if (rect.width <= 0 || rect.height <= 0) return

      await root.configure({
        camera: { fov: 36, near: 0.1, far: 40 },
        dpr: [1, 1.5],
        events,
        gl: { antialias: true, alpha: false, powerPreference: 'high-performance' },
        shadows: true,
        size: {
          width: rect.width,
          height: rect.height,
          top: rect.top,
          left: rect.left,
        },
        onCreated: (state) => {
          state.gl.outputColorSpace = THREE.SRGBColorSpace
          state.gl.shadowMap.type = THREE.PCFShadowMap
          state.gl.toneMapping = THREE.ACESFilmicToneMapping
          state.gl.toneMappingExposure = 0.9
          state.events.connect?.(container)
          state.setEvents({
            compute: (event, eventState) => {
              const bounds = container.getBoundingClientRect()
              const x = event.clientX - bounds.left
              const y = event.clientY - bounds.top
              eventState.pointer.set(
                (x / bounds.width) * 2 - 1,
                -(y / bounds.height) * 2 + 1,
              )
              eventState.camera.updateMatrixWorld(true)
              eventState.raycaster.setFromCamera(eventState.pointer, eventState.camera)
            },
          })
        },
      })

      if (!disposed) {
        root.render(<DeskContents {...latestSceneProps.current} />)
        setUnavailable(false)
      }
    }

    const resizeObserver = new ResizeObserver(() => {
      void configure().catch(() => setUnavailable(true))
    })
    resizeObserver.observe(container)
    void configure().catch(() => setUnavailable(true))

    return () => {
      disposed = true
      resizeObserver.disconnect()
      rootRef.current = null
      releaseRoot(canvas)
    }
  }, [])

  useEffect(() => {
    latestSceneProps.current = {
      advanceNotebookPhase,
      commitStickerPosition,
      notebookPhase,
      placePendingDeskSticker,
      previewStickerPosition,
      reducedMotion,
      requestNotebookOpen,
      selectSticker,
      selectedStickerId,
      stickers,
      stickerWorkflow,
    }
    if (rootRef.current) {
      rootRef.current.render(<DeskContents {...latestSceneProps.current} />)
    }
  }, [
    advanceNotebookPhase,
    commitStickerPosition,
    notebookPhase,
    placePendingDeskSticker,
    previewStickerPosition,
    reducedMotion,
    requestNotebookOpen,
    selectSticker,
    selectedStickerId,
    stickers,
    stickerWorkflow,
  ])

  return (
    <div ref={containerRef} className="canvas-root">
      <canvas ref={canvasRef} aria-label="Dear Desk 三维桌面" />
      {unavailable ? fallback : null}
    </div>
  )
}
