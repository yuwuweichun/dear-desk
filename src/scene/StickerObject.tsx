import type { ThreeEvent } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'

import {
  normalizeStickerScale,
  STICKER_MAX_EDGE,
  type PlacedSticker,
  type StickerPosition,
} from '../domain/sticker'
import { useStickerTexture } from './useStickerTexture'

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
  const texture = useStickerTexture(sticker.asset.blob)
  const dragging = useRef(false)
  const dragPoint = useMemo(() => new THREE.Vector3(), [])
  const dragOffset = useMemo(() => new THREE.Vector3(), [])

  const setAnimalCursor = (active: boolean) => {
    document.body.classList.toggle('animal-cursor', active)
    document.body.classList.toggle('animal-cursor--force', active)
  }

  useEffect(() => {
    if (!selected || !interactive) return
    setAnimalCursor(true)
    return () => {
      setAnimalCursor(false)
    }
  }, [interactive, selected])

  if (!texture || sticker.instance.surface !== 'desk') return null
  const currentPosition = sticker.instance.position as StickerPosition
  const aspect = sticker.asset.width / sticker.asset.height
  const maxEdge = STICKER_MAX_EDGE * normalizeStickerScale(sticker.instance.scale)
  const width = aspect >= 1 ? maxEdge : maxEdge * aspect
  const height = aspect >= 1 ? maxEdge / aspect : maxEdge

  const worldPointFromEvent = (event: ThreeEvent<PointerEvent>) => {
    const intersection = event.ray.intersectPlane(dragPlane, dragPoint)
    return intersection ? { x: intersection.x, z: intersection.z } : null
  }

  const positionFromEvent = (event: ThreeEvent<PointerEvent>) => {
    const point = worldPointFromEvent(event)
    return point
      ? { x: point.x + dragOffset.x, z: point.z + dragOffset.z }
      : null
  }

  return (
    <group
      position={[sticker.instance.position.x, 0.115, sticker.instance.position.z]}
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
          const point = worldPointFromEvent(event)
          if (point) {
            dragOffset.set(
              currentPosition.x - point.x,
              0,
              currentPosition.z - point.z,
            )
          }
          dragging.current = true
          onSelect(sticker.instance.id)
          ;(event.target as Element).setPointerCapture?.(event.pointerId)
          setAnimalCursor(true)
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
          setAnimalCursor(true)
          const position = positionFromEvent(event)
          if (position) onCommitPosition(sticker.instance.id, position)
        }}
        onPointerCancel={() => {
          dragging.current = false
          dragOffset.set(0, 0, 0)
          setAnimalCursor(selected && interactive)
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
