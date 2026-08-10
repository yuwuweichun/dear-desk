import { createRoot, events, extend, useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { ReconcilerRoot } from '@react-three/fiber'
import * as THREE from 'three'

import type { PlacedSticker, StickerPosition } from '../domain/sticker'
import { useAppStore } from '../state/app-store-context'
import type { NotebookPhase, StickerWorkflow } from '../state/app-store'
import { NotebookObject } from './NotebookObject'
import { RoundedBox } from './RoundedBox'
import { createSurfaceTexture, SCENE_PALETTE } from './scene-visuals'
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
const DESK_DRAWER_CENTERS = [-3.25, 0, 3.25]
const DESK_LEG_POSITIONS: Array<[number, number, number]> = [
  [-5.05, -2.08, -3.02],
  [5.05, -2.08, -3.02],
  [-5.05, -2.08, 3.02],
  [5.05, -2.08, 3.02],
]

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

function DeskBody({ woodTexture }: { woodTexture: THREE.Texture }) {
  return (
    <group>
      <RoundedBox
        size={[12, 0.78, 8]}
        radius={0.18}
        segments={4}
        position={[0, -0.43, 0]}
        castShadow
        receiveShadow
      >
        <meshStandardMaterial map={woodTexture} roughness={0.79} />
      </RoundedBox>
      <RoundedBox
        size={[11.3, 0.34, 0.3]}
        radius={0.08}
        position={[0, -0.84, 3.65]}
        castShadow
      >
        <meshStandardMaterial color={SCENE_PALETTE.walnutDark} roughness={0.82} />
      </RoundedBox>
      {DESK_DRAWER_CENTERS.map((x) => (
        <group key={x} position={[x, -0.49, 3.86]}>
          <RoundedBox size={[2.62, 0.42, 0.14]} radius={0.06} castShadow>
            <meshStandardMaterial color={SCENE_PALETTE.honeyWood} roughness={0.8} />
          </RoundedBox>
          <mesh position={[0, 0, 0.12]} rotation={[Math.PI / 2, 0, 0]} castShadow>
            <cylinderGeometry args={[0.09, 0.09, 0.14, 16]} />
            <meshStandardMaterial
              color={SCENE_PALETTE.brass}
              metalness={0.56}
              roughness={0.44}
            />
          </mesh>
        </group>
      ))}
      {DESK_LEG_POSITIONS.map(([x, y, z]) => (
        <mesh key={`${x}-${z}`} position={[x, y, z]} rotation={[0, Math.PI / 4, 0]} castShadow>
          <cylinderGeometry args={[0.29, 0.42, 2.65, 4]} />
          <meshStandardMaterial color={SCENE_PALETTE.walnutDark} roughness={0.84} />
        </mesh>
      ))}
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
  const woodTexture = useMemo(() => createSurfaceTexture('wood'), [])

  useEffect(() => () => woodTexture.dispose(), [woodTexture])

  return (
    <>
      <color attach="background" args={[SCENE_PALETTE.background]} />
      <fog attach="fog" args={[SCENE_PALETTE.background, 10, 21]} />
      <ambientLight intensity={1.15} color="#d9dfd7" />
      <directionalLight
        castShadow
        color="#ffe0ad"
        intensity={2.75}
        position={[-4, 9, 5]}
        shadow-mapSize={[1024, 1024]}
        shadow-bias={-0.0002}
      />
      <directionalLight color="#9fb5ad" intensity={0.62} position={[7, 4, -5]} />
      <CameraRig
        notebookPhase={notebookPhase}
        onAdvance={advanceNotebookPhase}
        reducedMotion={reducedMotion}
      />

      <DeskBody woodTexture={woodTexture} />
      <group
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
        <RoundedBox
          size={[8.7, 0.13, 6.25]}
          radius={0.18}
          segments={4}
          position={[0, 0.025, 0.2]}
          receiveShadow
        >
          <meshStandardMaterial color={SCENE_PALETTE.cloth} roughness={0.96} />
        </RoundedBox>
        <RoundedBox
          size={[8.32, 0.018, 0.025]}
          radius={0.01}
          position={[0, 0.102, -2.69]}
        >
          <meshStandardMaterial color="#718077" roughness={0.92} />
        </RoundedBox>
        <RoundedBox
          size={[8.32, 0.018, 0.025]}
          radius={0.01}
          position={[0, 0.102, 3.09]}
        >
          <meshStandardMaterial color="#718077" roughness={0.92} />
        </RoundedBox>
        <RoundedBox
          size={[0.025, 0.018, 5.78]}
          radius={0.01}
          position={[-4.15, 0.102, 0.2]}
        >
          <meshStandardMaterial color="#718077" roughness={0.92} />
        </RoundedBox>
        <RoundedBox
          size={[0.025, 0.018, 5.78]}
          radius={0.01}
          position={[4.15, 0.102, 0.2]}
        >
          <meshStandardMaterial color="#718077" roughness={0.92} />
        </RoundedBox>
      </group>
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
