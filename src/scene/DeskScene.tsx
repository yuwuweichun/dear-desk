import { createRoot, events, extend, useThree } from '@react-three/fiber'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { ReconcilerRoot } from '@react-three/fiber'
import * as THREE from 'three'

import { useAppStore } from '../state/app-store-context'
import { NotebookObject } from './NotebookObject'

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

function ResponsiveCamera() {
  const { camera, size } = useThree()

  useEffect(() => {
    if (size.width < 700) {
      camera.position.set(6.6, 8.4, 10.8)
    } else {
      camera.position.set(7.8, 7.2, 9.6)
    }
    camera.lookAt(0, 0, 0)
    camera.updateMatrixWorld(true)
  }, [camera, size.width])

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
  notebookOpen: boolean
  openNotebook: () => void
}

function DeskContents({ notebookOpen, openNotebook }: DeskContentsProps) {
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
      <ResponsiveCamera />

      <mesh position={[0, -0.46, 0]} castShadow receiveShadow>
        <boxGeometry args={[12, 0.8, 8]} />
        <meshStandardMaterial color="#75543f" roughness={0.82} />
      </mesh>
      <mesh position={[0, 0.02, 0.2]} receiveShadow>
        <boxGeometry args={[8.7, 0.12, 6.25]} />
        <meshStandardMaterial color="#315b57" roughness={0.92} />
      </mesh>
      <mesh position={[-4.55, 0.13, -2.1]} castShadow>
        <boxGeometry args={[1.7, 0.24, 1.4]} />
        <meshStandardMaterial color="#b5a57f" roughness={0.9} />
      </mesh>
      <mesh position={[-4.55, 0.27, -2.1]}>
        <boxGeometry args={[1.5, 0.04, 1.18]} />
        <meshStandardMaterial color="#d2c69f" roughness={1} />
      </mesh>
      <NotebookObject onOpen={openNotebook} open={notebookOpen} />
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
  const openNotebook = useAppStore((state) => state.openNotebook)
  const notebookOpen = useAppStore((state) => state.notebookOpen)
  const latestSceneProps = useRef<DeskContentsProps>({ notebookOpen, openNotebook })

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
    latestSceneProps.current = { notebookOpen, openNotebook }
    if (rootRef.current) {
      rootRef.current.render(<DeskContents {...latestSceneProps.current} />)
    }
  }, [notebookOpen, openNotebook])

  return (
    <div ref={containerRef} className="canvas-root">
      <canvas ref={canvasRef} aria-label="Dear Desk 三维桌面" />
      {unavailable ? fallback : null}
    </div>
  )
}
