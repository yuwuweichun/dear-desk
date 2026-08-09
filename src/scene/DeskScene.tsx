import { createRoot, events, extend, useFrame, useThree } from '@react-three/fiber'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { ReconcilerRoot } from '@react-three/fiber'
import * as THREE from 'three'

import type { PlacedSticker, StickerPosition } from '../domain/sticker'
import { useAppStore } from '../state/app-store-context'
import type { NotebookPhase, StickerWorkflow } from '../state/app-store'
import { NotebookObject } from './NotebookObject'
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
  ConeGeometry: THREE.ConeGeometry,
  CylinderGeometry: THREE.CylinderGeometry,
  DirectionalLight: THREE.DirectionalLight,
  Fog: THREE.Fog,
  Group: THREE.Group,
  Mesh: THREE.Mesh,
  MeshBasicMaterial: THREE.MeshBasicMaterial,
  MeshStandardMaterial: THREE.MeshStandardMaterial,
  PlaneGeometry: THREE.PlaneGeometry,
  TorusGeometry: THREE.TorusGeometry,
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
    ? cameraPose([6.6, 8.4, 10.8], [0, 0, 0], 36)
    : cameraPose([7.8, 7.2, 9.6], [0, 0, 0], 36),
  focus: mobile
    ? cameraPose([0.1, 9.2, 5.4], [-0.72, 0.18, 0.25], 36)
    : cameraPose([0.35, 7.2, 4.35], [-0.78, 0.18, 0.25], 31),
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

function Pencil() {
  return (
    <group position={[1.72, 0.33, 0.3]} rotation={[0, -0.28, -0.08]}>
      <mesh castShadow rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.085, 0.085, 3.1, 6]} />
        <meshStandardMaterial color="#d5a142" roughness={0.62} />
      </mesh>
      <mesh position={[-1.6, 0, 0]} castShadow rotation={[0, 0, Math.PI / 2]}>
        <coneGeometry args={[0.09, 0.28, 6]} />
        <meshStandardMaterial color="#d8c49f" roughness={0.9} />
      </mesh>
      <mesh position={[1.63, 0, 0]} castShadow rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.09, 0.09, 0.2, 8]} />
        <meshStandardMaterial color="#b55a58" roughness={0.7} />
      </mesh>
    </group>
  )
}

function Mug() {
  return (
    <group position={[3.15, 0.58, -1.65]}>
      <mesh castShadow receiveShadow>
        <cylinderGeometry args={[0.58, 0.5, 1.1, 28]} />
        <meshStandardMaterial color="#d9d0bd" roughness={0.68} />
      </mesh>
      <mesh position={[0.58, 0, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <torusGeometry args={[0.34, 0.1, 12, 24]} />
        <meshStandardMaterial color="#d9d0bd" roughness={0.68} />
      </mesh>
      <mesh position={[0, 0.56, 0]}>
        <cylinderGeometry args={[0.48, 0.48, 0.025, 28]} />
        <meshStandardMaterial color="#3a2420" roughness={0.5} />
      </mesh>
    </group>
  )
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
  return (
    <>
      <color attach="background" args={['#17201d']} />
      <fog attach="fog" args={['#17201d', 10, 20]} />
      <ambientLight intensity={1.25} color="#d9e3dc" />
      <directionalLight
        castShadow
        color="#ffe4b8"
        intensity={3.1}
        position={[-4, 9, 5]}
        shadow-mapSize={[1024, 1024]}
        shadow-bias={-0.0002}
      />
      <directionalLight color="#9ab8bd" intensity={0.7} position={[7, 4, -5]} />
      <CameraRig
        notebookPhase={notebookPhase}
        onAdvance={advanceNotebookPhase}
        reducedMotion={reducedMotion}
      />

      <mesh position={[0, -0.46, 0]} castShadow receiveShadow>
        <boxGeometry args={[12, 0.8, 8]} />
        <meshStandardMaterial color="#75543f" roughness={0.82} />
      </mesh>
      <mesh
        position={[0, 0.02, 0.2]}
        receiveShadow
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
        <boxGeometry args={[8.7, 0.12, 6.25]} />
        <meshStandardMaterial color="#315b57" roughness={0.92} />
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
      <mesh position={[-4.55, 0.13, -2.1]} castShadow>
        <boxGeometry args={[1.7, 0.24, 1.4]} />
        <meshStandardMaterial color="#b5a57f" roughness={0.9} />
      </mesh>
      <mesh position={[-4.55, 0.27, -2.1]}>
        <boxGeometry args={[1.5, 0.04, 1.18]} />
        <meshStandardMaterial color="#d2c69f" roughness={1} />
      </mesh>
      <NotebookObject
        notebookPhase={notebookPhase}
        onAdvance={advanceNotebookPhase}
        onOpen={requestNotebookOpen}
        reducedMotion={reducedMotion}
      />
      <Pencil />
      <Mug />
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
