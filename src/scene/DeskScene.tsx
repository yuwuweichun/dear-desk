import { createRoot, events, extend, useFrame, useThree } from '@react-three/fiber'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { ReconcilerRoot } from '@react-three/fiber'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'

import type { ContentFontId } from '../domain/journal-font'
import type { PlacedSticker, StickerPosition } from '../domain/sticker'
import { useAppStore } from '../state/app-store-context'
import type {
  DeskCameraPreset,
  NotebookPhase,
  PastTracesPhase,
  StickerWorkflow,
} from '../state/app-store'
import { NotebookObject } from './NotebookObject'
import { createDeskMatModel } from './models/create-desk-mat-model'
import { createStudyRoomShellModel } from './models/create-study-room-shell-model'
import {
  createDeskModel,
  setDeskDrawerProgress,
} from './models/create-desk-model'
import {
  applySceneColors,
  createModelMaterialLibrary,
  type ModelMaterialLibrary,
  type SceneColorConfig,
} from './models/material-library'
import { DESK_MAT_MODEL_SPEC, DESK_MODEL_SPEC } from './models/model-specs'
import { PAST_TRACE_DRAWER_DURATION_SECONDS } from '../domain/past-trace'
import { SceneEnvironment } from './models/SceneEnvironment'
import { StickerObject } from './StickerObject'
import {
  easeInOutCubic,
  getDeskCameraTransitionDuration,
  getNotebookTransitionDuration,
  type AnimatedNotebookPhase,
} from './notebook-transition'
import {
  captureScenePreview,
  type CaptureScenePreview,
} from './capture-scene-preview'

extend({
  AmbientLight: THREE.AmbientLight,
  BoxGeometry: THREE.BoxGeometry,
  Color: THREE.Color,
  CylinderGeometry: THREE.CylinderGeometry,
  DirectionalLight: THREE.DirectionalLight,
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
  far: mobile
    ? cameraPose([6.7, 7.7, 11.5], [0, -0.45, 0.15], 37)
    : cameraPose([8.9, 5.7, 11.3], [0, -0.9, 0.2], 35),
  front: mobile
    ? cameraPose([0.1, 8.4, 14.2], [0, -0.5, 0.15], 42)
    : cameraPose([0.15, 6.8, 13.6], [0, -0.75, 0.15], 36),
  near: mobile
    ? cameraPose([0, 10.6, 6.2], [0, 0.22, 0.2], 43)
    : cameraPose([0, 8.6, 5.1], [0, 0.22, 0.2], 37),
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

interface CameraKeyframe {
  fov: number
  position: THREE.Vector3
  quaternion: THREE.Quaternion
}

const keyframeForPose = (pose: CameraPose): CameraKeyframe => ({
  fov: pose.fov,
  position: pose.position.clone(),
  quaternion: quaternionForPose(pose),
})

const keyframeForCamera = (camera: THREE.PerspectiveCamera): CameraKeyframe => ({
  fov: camera.fov,
  position: camera.position.clone(),
  quaternion: camera.quaternion.clone(),
})

interface CameraRigProps {
  deskCameraPreset: DeskCameraPreset
  deskCameraTransitioning: boolean
  freeCameraEnabled: boolean
  notebookPhase: NotebookPhase
  onAdvance: (from: NotebookPhase) => void
  onCameraSettled: () => void
  reducedMotion: boolean
}

function CameraRig({
  deskCameraPreset,
  deskCameraTransitioning,
  freeCameraEnabled,
  notebookPhase,
  onAdvance,
  onCameraSettled,
  reducedMotion,
}: CameraRigProps) {
  const { camera, size } = useThree()
  const transition = useRef<{
    from: CameraKeyframe
    kind: AnimatedNotebookPhase | 'preset'
    startedAt: number
    to: CameraKeyframe
  } | null>(null)

  useEffect(() => {
    if (!(camera instanceof THREE.PerspectiveCamera)) return
    const poses = getCameraPoses(size.width < 700)

    if (freeCameraEnabled && notebookPhase === 'desk') {
      transition.current = null
      return
    }

    if (notebookPhase === 'desk') {
      if (deskCameraTransitioning) {
        transition.current = {
          from: keyframeForCamera(camera),
          kind: 'preset',
          startedAt: performance.now(),
          to: keyframeForPose(poses[deskCameraPreset]),
        }
      } else {
        transition.current = null
        applyCameraPose(camera, poses[deskCameraPreset])
      }
      return
    }
    if (notebookPhase === 'editing') {
      transition.current = null
      applyCameraPose(camera, poses.near)
      return
    }
    if (notebookPhase === 'opening' || notebookPhase === 'closing') {
      transition.current = null
      applyCameraPose(camera, poses.near)
      return
    }

    transition.current = {
      from: keyframeForCamera(camera),
      kind: notebookPhase,
      startedAt: performance.now(),
      to: keyframeForPose(
        notebookPhase === 'approaching' ? poses.near : poses[deskCameraPreset],
      ),
    }
  }, [
    camera,
    deskCameraPreset,
    deskCameraTransitioning,
    freeCameraEnabled,
    notebookPhase,
    size.width,
  ])

  useFrame((state) => {
    if (!(state.camera instanceof THREE.PerspectiveCamera)) return
    const frameCamera = state.camera
    const active = transition.current
    if (!active) return

    const duration = active.kind === 'preset'
      ? getDeskCameraTransitionDuration(reducedMotion, size.width < 700)
      : getNotebookTransitionDuration(active.kind, reducedMotion, size.width < 700)
    const elapsed = Math.min(
      (performance.now() - active.startedAt) / 1000,
      duration,
    )
    const progress = easeInOutCubic(elapsed / duration)

    frameCamera.position.lerpVectors(
      active.from.position,
      active.to.position,
      progress,
    )
    frameCamera.quaternion.slerpQuaternions(
      active.from.quaternion,
      active.to.quaternion,
      progress,
    )
    frameCamera.fov = THREE.MathUtils.lerp(
      active.from.fov,
      active.to.fov,
      progress,
    )
    frameCamera.updateProjectionMatrix()
    frameCamera.updateMatrixWorld(true)

    if (elapsed >= duration) {
      transition.current = null
      if (active.kind === 'preset') onCameraSettled()
      else onAdvance(active.kind)
    }
  })

  return null
}

interface FreeOrbitCameraProps {
  deskCameraPreset: DeskCameraPreset
  enabled: boolean
}

function FreeOrbitCamera({ deskCameraPreset, enabled }: FreeOrbitCameraProps) {
  const { camera, gl, size } = useThree()
  const controlsRef = useRef<OrbitControls | null>(null)

  useEffect(() => {
    if (!enabled || !(camera instanceof THREE.PerspectiveCamera)) return
    const controls = new OrbitControls(camera, gl.domElement)
    const pose = getCameraPoses(size.width < 700)[deskCameraPreset]
    controls.target.copy(pose.target)
    controls.enableDamping = true
    controls.dampingFactor = 0.08
    controls.enablePan = false
    controls.enableZoom = false
    controls.rotateSpeed = 0.65
    controls.minPolarAngle = 0.22
    controls.maxPolarAngle = Math.PI / 2 - 0.08
    controls.update()
    controlsRef.current = controls

    return () => {
      controlsRef.current = null
      controls.dispose()
    }
  }, [camera, deskCameraPreset, enabled, gl, size.width])

  useFrame(() => {
    controlsRef.current?.update()
  })

  return null
}

const disposeFactoryModel = (model: THREE.Group) => {
  const dispose = model.userData.dispose
  if (typeof dispose === 'function') dispose()
}

interface DeskBodyProps {
  materials: ModelMaterialLibrary
  onOpenPastTraces: () => void
  onSettlePastTraces: () => void
  pastTracesPhase: PastTracesPhase
  reducedMotion: boolean
}

function DeskBody({
  materials,
  onOpenPastTraces,
  onSettlePastTraces,
  pastTracesPhase,
  reducedMotion,
}: DeskBodyProps) {
  const [model, setModel] = useState<THREE.Group | null>(null)
  const progressRef = useRef(
    pastTracesPhase === 'open' || pastTracesPhase === 'closing' ? 1 : 0,
  )
  const settledPhaseRef = useRef<PastTracesPhase | null>(null)

  useEffect(() => {
    const nextModel = createDeskModel(materials, {
      pass: 'optimization-pass',
    })
    let disposed = false
    setDeskDrawerProgress(
      nextModel,
      'drawer-center',
      easeInOutCubic(progressRef.current),
    )
    queueMicrotask(() => {
      if (!disposed) setModel(nextModel)
    })
    return () => {
      disposed = true
      disposeFactoryModel(nextModel)
    }
  }, [materials])

  useEffect(() => {
    settledPhaseRef.current = null
  }, [pastTracesPhase])

  useEffect(() => () => {
    document.body.style.cursor = ''
  }, [])

  useFrame((_state, delta) => {
    if (!model) return
    const target = pastTracesPhase === 'opening' || pastTracesPhase === 'open' ? 1 : 0
    if (
      progressRef.current === target &&
      (pastTracesPhase === 'open' || pastTracesPhase === 'closed')
    ) {
      return
    }
    const distance = reducedMotion
      ? 1
      : delta / PAST_TRACE_DRAWER_DURATION_SECONDS
    const next = progressRef.current < target
      ? Math.min(target, progressRef.current + distance)
      : Math.max(target, progressRef.current - distance)
    const reached = next === target
    progressRef.current = reached ? target : next
    setDeskDrawerProgress(
      model,
      'drawer-center',
      easeInOutCubic(progressRef.current),
    )

    if (
      reached &&
      (pastTracesPhase === 'opening' || pastTracesPhase === 'closing') &&
      settledPhaseRef.current !== pastTracesPhase
    ) {
      settledPhaseRef.current = pastTracesPhase
      onSettlePastTraces()
    }
  })

  if (!model) return null

  return (
    <>
      <primitive object={model} dispose={null} />
      {pastTracesPhase === 'closed' ? (
        <mesh
          name="past-traces-center-drawer-hit-surface"
          position={[
            DESK_MODEL_SPEC.drawers[1].positionX,
            DESK_MODEL_SPEC.drawerPositionY,
            DESK_MODEL_SPEC.drawerPositionZ + 0.08,
          ]}
          onClick={(event) => {
            event.stopPropagation()
            document.body.style.cursor = ''
            onOpenPastTraces()
          }}
          onPointerOut={() => {
            document.body.style.cursor = ''
          }}
          onPointerOver={(event) => {
            event.stopPropagation()
            document.body.style.cursor = 'pointer'
          }}
        >
          <boxGeometry args={[
            DESK_MODEL_SPEC.drawers[1].width,
            DESK_MODEL_SPEC.drawerHeight,
            0.36,
          ]} />
          <meshBasicMaterial
            colorWrite={false}
            depthWrite={false}
            opacity={0}
            transparent
          />
        </mesh>
      ) : null}
    </>
  )
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

function StudyRoomShell() {
  const [model, setModel] = useState<THREE.Group | null>(null)

  useEffect(() => {
    const nextModel = createStudyRoomShellModel({ pass: 'optimization-pass' })
    let disposed = false
    queueMicrotask(() => {
      if (!disposed) setModel(nextModel)
    })
    return () => {
      disposed = true
      disposeFactoryModel(nextModel)
    }
  }, [])

  return model ? <primitive object={model} dispose={null} /> : null
}

interface DeskContentsProps {
  advanceNotebookPhase: (from: NotebookPhase) => void
  commitStickerPosition: (
    instanceId: string,
    position: StickerPosition,
  ) => Promise<boolean>
  contentFont: ContentFontId
  deskCameraPreset: DeskCameraPreset
  deskCameraTransitioning: boolean
  freeCameraEnabled: boolean
  showRoomBackground: boolean
  notebookPhase: NotebookPhase
  notebookCoverLabel: string
  pastTracesPhase: PastTracesPhase
  placePendingDeskSticker: (position: StickerPosition) => Promise<boolean>
  colors: SceneColorConfig
  previewStickerPosition: (instanceId: string, position: StickerPosition) => void
  reducedMotion: boolean
  requestNotebookOpen: () => void
  requestPastTracesOpen: () => void
  settlePastTracesTransition: () => void
  settleDeskCameraPreset: () => void
  selectSticker: (instanceId: string | null) => void
  selectedStickerId: string | null
  stickers: PlacedSticker[]
  stickerWorkflow: StickerWorkflow
}

function DeskContents({
  advanceNotebookPhase,
  commitStickerPosition,
  contentFont,
  deskCameraPreset,
  deskCameraTransitioning,
  freeCameraEnabled,
  showRoomBackground,
  notebookPhase,
  notebookCoverLabel,
  pastTracesPhase,
  placePendingDeskSticker,
  colors,
  previewStickerPosition,
  reducedMotion,
  requestNotebookOpen,
  requestPastTracesOpen,
  settlePastTracesTransition,
  settleDeskCameraPreset,
  selectSticker,
  selectedStickerId,
  stickers,
  stickerWorkflow,
}: DeskContentsProps) {
  const { scene } = useThree()
  const [materials, setMaterials] = useState<ModelMaterialLibrary | null>(null)
  const initialColors = useRef(colors)

  useEffect(() => {
    // The canvas root is reused across scene mounts, so explicitly clear fog
    // left behind by a previous render or a hot-reloaded scene tree.
    Object.assign(scene, { fog: null })
  }, [scene])

  useEffect(() => {
    const nextMaterials = createModelMaterialLibrary({ sceneColors: initialColors.current })
    let disposed = false
    queueMicrotask(() => {
      if (!disposed) setMaterials(nextMaterials)
    })
    return () => {
      disposed = true
      nextMaterials.dispose()
    }
  }, [])

  useEffect(() => {
    if (materials) applySceneColors(materials, colors)
  }, [colors, materials])

  if (!materials) {
    return (
      <>
        <color attach="background" args={[colors.background]} />
      </>
    )
  }

  return (
    <>
      <color attach="background" args={[colors.background]} />
      <hemisphereLight args={['#fffbe7', '#79b8aa', 0.86]} />
      <directionalLight
        castShadow
        color="#fff4d6"
        intensity={1.68}
        position={[-5.5, 10.5, 7]}
        shadow-mapSize={[1536, 1536]}
        shadow-bias={-0.00016}
        shadow-normalBias={0.025}
        shadow-radius={3.5}
        shadow-camera-left={-9}
        shadow-camera-right={9}
        shadow-camera-top={9}
        shadow-camera-bottom={-9}
        shadow-camera-near={1}
        shadow-camera-far={24}
      />
      <directionalLight color="#8de0d1" intensity={0.28} position={[7, 5, -6]} />
      <SceneEnvironment intensity={0.28} />
      <CameraRig
        deskCameraPreset={deskCameraPreset}
        deskCameraTransitioning={deskCameraTransitioning}
        freeCameraEnabled={freeCameraEnabled}
        notebookPhase={notebookPhase}
        onAdvance={advanceNotebookPhase}
        onCameraSettled={settleDeskCameraPreset}
        reducedMotion={reducedMotion}
      />
      <FreeOrbitCamera
        deskCameraPreset={deskCameraPreset}
        enabled={
          freeCameraEnabled &&
          notebookPhase === 'desk' &&
          pastTracesPhase === 'closed'
        }
      />

      {showRoomBackground ? <StudyRoomShell /> : null}

      <DeskBody
        materials={materials}
        onOpenPastTraces={requestPastTracesOpen}
        onSettlePastTraces={settlePastTracesTransition}
        pastTracesPhase={pastTracesPhase}
        reducedMotion={reducedMotion}
      />
      <DeskMat materials={materials} />
      <mesh
        name="desk-mat-hit-surface"
        position={[0, DESK_MAT_MODEL_SPEC.topY, 0.2]}
        rotation={[-Math.PI / 2, 0, 0]}
        onClick={(event) => {
          if (pastTracesPhase !== 'closed') return
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
          interactive={
            stickerWorkflow === 'idle' &&
            notebookPhase === 'desk' &&
            pastTracesPhase === 'closed'
          }
          selected={selectedStickerId === sticker.instance.id}
          onSelect={selectSticker}
          onPreviewPosition={previewStickerPosition}
          onCommitPosition={(instanceId, position) => {
            void commitStickerPosition(instanceId, position)
          }}
        />
      ))}
      <NotebookObject
        contentFont={contentFont}
        deskCameraPreset={deskCameraPreset}
        materials={materials}
        notebookPhase={notebookPhase}
        onAdvance={advanceNotebookPhase}
        onOpen={requestNotebookOpen}
        reducedMotion={reducedMotion}
        label={notebookCoverLabel}
      />
    </>
  )
}

interface DeskSceneProps {
  colors: SceneColorConfig
  contentFont: ContentFontId
  fallback: ReactNode
  onCaptureReady?: (capture: CaptureScenePreview | null) => void
  showRoomBackground: boolean
}

export function DeskScene({
  colors,
  contentFont,
  fallback,
  onCaptureReady,
  showRoomBackground,
}: DeskSceneProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const captureRef = useRef<CaptureScenePreview | null>(null)
  const onCaptureReadyRef = useRef(onCaptureReady)
  const rootRef = useRef<ReconcilerRoot<HTMLCanvasElement> | null>(null)
  const [unavailable, setUnavailable] = useState(false)
  const [reducedMotion, setReducedMotion] = useState(false)
  const advanceNotebookPhase = useAppStore((state) => state.advanceNotebookPhase)
  const deskCameraPreset = useAppStore((state) => state.deskCameraPreset)
  const deskCameraTransitioning = useAppStore(
    (state) => state.deskCameraTransitioning,
  )
  const freeCameraEnabled = useAppStore((state) => state.freeCameraEnabled)
  const commitStickerPosition = useAppStore(
    (state) => state.commitStickerPosition,
  )
  const notebookPhase = useAppStore((state) => state.notebookPhase)
  const pastTracesPhase = useAppStore((state) => state.pastTracesPhase)
  const notebookCoverLabel = useAppStore(
    (state) => state.notebookCoverSettings?.label ?? '',
  )
  const placePendingDeskSticker = useAppStore((state) => state.placePendingDeskSticker)
  const previewStickerPosition = useAppStore(
    (state) => state.previewStickerPosition,
  )
  const requestNotebookOpen = useAppStore((state) => state.requestNotebookOpen)
  const requestPastTracesOpen = useAppStore(
    (state) => state.requestPastTracesOpen,
  )
  const settlePastTracesTransition = useAppStore(
    (state) => state.settlePastTracesTransition,
  )
  const settleDeskCameraPreset = useAppStore(
    (state) => state.settleDeskCameraPreset,
  )
  const selectSticker = useAppStore((state) => state.selectSticker)
  const selectedStickerId = useAppStore((state) => state.selectedStickerId)
  const stickers = useAppStore((state) => state.stickers)
  const stickerWorkflow = useAppStore((state) => state.stickerWorkflow)
  const latestSceneProps = useRef<DeskContentsProps>({
    advanceNotebookPhase,
    commitStickerPosition,
    contentFont,
    deskCameraPreset,
    deskCameraTransitioning,
    freeCameraEnabled,
    showRoomBackground,
    notebookPhase,
    notebookCoverLabel,
    pastTracesPhase,
    placePendingDeskSticker,
    colors,
    previewStickerPosition,
    reducedMotion,
    requestNotebookOpen,
    requestPastTracesOpen,
    settlePastTracesTransition,
    settleDeskCameraPreset,
    selectSticker,
    selectedStickerId,
    stickers,
    stickerWorkflow,
  })

  useEffect(() => {
    onCaptureReadyRef.current = onCaptureReady
    onCaptureReady?.(captureRef.current)
  }, [onCaptureReady])

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
    if (!deskCameraTransitioning) return
    if (reducedMotion) {
      settleDeskCameraPreset()
      return
    }
    const timer = window.setTimeout(
      settleDeskCameraPreset,
      getDeskCameraTransitionDuration(false, window.innerWidth < 700) * 1000,
    )
    return () => window.clearTimeout(timer)
  }, [deskCameraTransitioning, reducedMotion, settleDeskCameraPreset])

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
        camera: { fov: 36, near: 0.1, far: 100 },
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
          state.gl.toneMappingExposure = 0.98
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
          captureRef.current = async () => {
            state.gl.render(state.scene, state.camera)
            return captureScenePreview(state.gl.domElement)
          }
          onCaptureReadyRef.current?.(captureRef.current)
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
      captureRef.current = null
      onCaptureReadyRef.current?.(null)
      rootRef.current = null
      releaseRoot(canvas)
    }
  }, [])

  useEffect(() => {
    latestSceneProps.current = {
      advanceNotebookPhase,
      commitStickerPosition,
      contentFont,
      deskCameraPreset,
      deskCameraTransitioning,
      freeCameraEnabled,
      showRoomBackground,
      notebookPhase,
      notebookCoverLabel,
      pastTracesPhase,
      placePendingDeskSticker,
      colors,
      previewStickerPosition,
      reducedMotion,
      requestNotebookOpen,
      requestPastTracesOpen,
      settlePastTracesTransition,
      settleDeskCameraPreset,
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
    contentFont,
    deskCameraPreset,
    deskCameraTransitioning,
    freeCameraEnabled,
    showRoomBackground,
    notebookPhase,
    notebookCoverLabel,
    pastTracesPhase,
    placePendingDeskSticker,
    colors,
    previewStickerPosition,
    reducedMotion,
    requestNotebookOpen,
    requestPastTracesOpen,
    settlePastTracesTransition,
    settleDeskCameraPreset,
    selectSticker,
    selectedStickerId,
    stickers,
    stickerWorkflow,
  ])

  return (
    <div
      ref={containerRef}
      className="canvas-root"
      data-scene-colors="custom"
    >
      <canvas ref={canvasRef} aria-label="Dear Desk 三维桌面" />
      {unavailable ? fallback : null}
    </div>
  )
}
