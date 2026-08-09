import type { ThreeEvent } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'

import type { PlacedSticker, StickerPosition } from '../domain/sticker'

const dragPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.11)

interface StickerObjectProps {
  interactive: boolean
  onCommitPosition: (instanceId: string, position: StickerPosition) => void
  onPreviewPosition: (instanceId: string, position: StickerPosition) => void
  onSelect: (instanceId: string) => void
  selected: boolean
  sticker: PlacedSticker
}

export function StickerObject({
  interactive,
  onCommitPosition,
  onPreviewPosition,
  onSelect,
  selected,
  sticker,
}: StickerObjectProps) {
  const [texture, setTexture] = useState<THREE.Texture | null>(null)
  const dragging = useRef(false)
  const dragPoint = useMemo(() => new THREE.Vector3(), [])

  useEffect(() => {
    const url = URL.createObjectURL(sticker.asset.blob)
    let active = true
    let loaded: THREE.Texture | null = null
    new THREE.TextureLoader().load(
      url,
      (nextTexture) => {
        loaded = nextTexture
        nextTexture.colorSpace = THREE.SRGBColorSpace
        nextTexture.needsUpdate = true
        if (active) setTexture(nextTexture)
        else nextTexture.dispose()
      },
      undefined,
      () => {
        if (active) setTexture(null)
      },
    )
    return () => {
      active = false
      loaded?.dispose()
      URL.revokeObjectURL(url)
    }
  }, [sticker.asset.blob])

  useEffect(() => {
    if (!selected || !interactive) return
    document.body.style.cursor = 'grab'
    return () => {
      document.body.style.cursor = ''
    }
  }, [interactive, selected])

  if (!texture || sticker.instance.surface !== 'desk') return null
  const aspect = sticker.asset.width / sticker.asset.height
  const width = aspect >= 1 ? 1.72 : 1.72 * aspect
  const height = aspect >= 1 ? 1.72 / aspect : 1.72

  const positionFromEvent = (event: ThreeEvent<PointerEvent>) => {
    const intersection = event.ray.intersectPlane(dragPlane, dragPoint)
    return intersection ? { x: intersection.x, z: intersection.z } : null
  }

  return (
    <group
      position={[
        sticker.instance.position.x,
        0.115,
        sticker.instance.position.z,
      ]}
      rotation={[0, sticker.instance.rotationY, 0]}
    >
      {selected ? (
        <group>
          {[
            { key: 'top', position: [0, -0.005, height / 2 + 0.045], size: [width + 0.14, 0.055] },
            { key: 'bottom', position: [0, -0.005, -height / 2 - 0.045], size: [width + 0.14, 0.055] },
            { key: 'left', position: [-width / 2 - 0.045, -0.005, 0], size: [0.055, height + 0.14] },
            { key: 'right', position: [width / 2 + 0.045, -0.005, 0], size: [0.055, height + 0.14] },
          ].map((edge) => (
            <mesh
              key={edge.key}
              rotation={[-Math.PI / 2, 0, 0]}
              position={edge.position as [number, number, number]}
            >
              <planeGeometry args={edge.size as [number, number]} />
              <meshBasicMaterial color="#f3c56e" transparent opacity={0.9} />
            </mesh>
          ))}
        </group>
      ) : null}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        onClick={(event) => {
          event.stopPropagation()
          if (interactive) onSelect(sticker.instance.id)
        }}
        onPointerDown={(event) => {
          event.stopPropagation()
          if (!interactive) return
          dragging.current = true
          onSelect(sticker.instance.id)
          ;(event.target as Element).setPointerCapture?.(event.pointerId)
          document.body.style.cursor = 'grabbing'
        }}
        onPointerMove={(event) => {
          if (!dragging.current || !interactive) return
          event.stopPropagation()
          const position = positionFromEvent(event)
          if (position) onPreviewPosition(sticker.instance.id, position)
        }}
        onPointerUp={(event) => {
          if (!dragging.current || !interactive) return
          event.stopPropagation()
          dragging.current = false
          ;(event.target as Element).releasePointerCapture?.(event.pointerId)
          document.body.style.cursor = 'grab'
          const position = positionFromEvent(event)
          if (position) onCommitPosition(sticker.instance.id, position)
        }}
        onPointerCancel={() => {
          dragging.current = false
          document.body.style.cursor = selected ? 'grab' : ''
        }}
      >
        <planeGeometry args={[width, height]} />
        <meshBasicMaterial
          map={texture}
          transparent
          alphaTest={0.015}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
    </group>
  )
}
