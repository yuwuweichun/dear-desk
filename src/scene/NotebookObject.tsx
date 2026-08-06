import { useFrame } from '@react-three/fiber'
import { useEffect, useRef, useState } from 'react'
import type { Group } from 'three'
import { MathUtils } from 'three'

interface NotebookObjectProps {
  onOpen: () => void
  open: boolean
}

const pageLines = [-1.03, -0.72, -0.41, -0.1, 0.21, 0.52]

export function NotebookObject({ onOpen, open }: NotebookObjectProps) {
  const group = useRef<Group>(null)
  const [hovered, setHovered] = useState(false)

  useEffect(() => {
    if (!hovered) return
    document.body.style.cursor = 'pointer'
    return () => {
      document.body.style.cursor = ''
    }
  }, [hovered])

  useFrame((_state, delta) => {
    if (!group.current) return
    const targetY = hovered || open ? 0.43 : 0.34
    group.current.position.y = MathUtils.damp(
      group.current.position.y,
      targetY,
      8,
      delta,
    )
    group.current.rotation.z = MathUtils.damp(
      group.current.rotation.z,
      open ? -0.06 : -0.12,
      7,
      delta,
    )
  })

  return (
    <group
      ref={group}
      position={[-0.65, 0.34, 0.25]}
      rotation={[0, -0.16, -0.12]}
    >
      <mesh
        position={[0, 0.34, 0]}
        onClick={(event) => {
          event.stopPropagation()
          onOpen()
        }}
        onPointerOver={(event) => {
          event.stopPropagation()
          setHovered(true)
        }}
        onPointerOut={() => setHovered(false)}
      >
        <boxGeometry args={[3.08, 0.12, 3.78]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[3.05, 0.18, 3.75]} />
        <meshStandardMaterial color="#9f3940" roughness={0.72} />
      </mesh>
      <mesh position={[0.05, 0.125, 0]} castShadow receiveShadow>
        <boxGeometry args={[2.84, 0.1, 3.5]} />
        <meshStandardMaterial color="#eee3cb" roughness={0.9} />
      </mesh>
      <mesh position={[0.11, 0.195, 0]} castShadow>
        <boxGeometry args={[2.78, 0.05, 3.45]} />
        <meshStandardMaterial color="#f7eedb" roughness={0.96} />
      </mesh>
      <mesh position={[-1.28, 0.24, 0]} castShadow>
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
      <mesh position={[-0.95, 0.225, 0]}>
        <boxGeometry args={[0.025, 0.012, 2.55]} />
        <meshStandardMaterial color="#d99a93" roughness={1} />
      </mesh>
    </group>
  )
}
