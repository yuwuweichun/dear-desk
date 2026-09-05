import type { ThreeEvent } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'

import {
  normalizeStickerScale,
  STICKER_MAX_EDGE,
  WALL_STICKER_SCALE_MAX,
  type PlacedSticker,
  type WallStickerPosition,
} from '../domain/sticker'
import { useStickerTexture } from './useStickerTexture'
import {
  WALL_STICKER_Z,
  wallStickerPositionFromWorld,
  wallStickerPositionToWorld,
} from './wall-sticker-layout'

const dragPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -WALL_STICKER_Z)

interface WallStickerObjectProps {
  interactive: boolean
  onCommitPosition: (instanceId: string, position: WallStickerPosition) => void
  onPreviewPosition: (instanceId: string, position: WallStickerPosition) => void
  onSelect: (instanceId: string) => void
  selected: boolean
  sticker: PlacedSticker
}

export function WallStickerObject({
  interactive,
  onCommitPosition,
  onPreviewPosition,
  onSelect,
  selected,
  sticker,
}: WallStickerObjectProps) {
  const texture = useStickerTexture(sticker.asset.blob)
  const dragging = useRef(false)
  const dragPoint = useMemo(() => new THREE.Vector3(), [])

  useEffect(() => {
    if (!selected || !interactive) return
    document.body.style.cursor = 'grab'
    return () => {
      document.body.style.cursor = ''
    }
  }, [interactive, selected])

  if (!texture || sticker.instance.surface !== 'wall') return null
  const aspect = sticker.asset.width / sticker.asset.height
  const scale = normalizeStickerScale(sticker.instance.scale, WALL_STICKER_SCALE_MAX)
  const maxEdge = STICKER_MAX_EDGE * scale
  const width = aspect >= 1 ? maxEdge : maxEdge * aspect
  const height = aspect >= 1 ? maxEdge / aspect : maxEdge
  const world = wallStickerPositionToWorld(sticker.instance.position, scale)

  const positionFromEvent = (event: ThreeEvent<PointerEvent>) => {
    const intersection = event.ray.intersectPlane(dragPlane, dragPoint)
    return intersection
      ? wallStickerPositionFromWorld({ x: intersection.x, y: intersection.y }, scale)
      : null
  }

  return (
    <group
      position={[world.x, world.y, WALL_STICKER_Z]}
      rotation={[0, 0, sticker.instance.rotationY]}
    >
      {selected ? (
        <group position={[0, 0, 0.002]}>
          {[
            { key: 'top', position: [0, height / 2 + 0.045, 0], size: [width + 0.14, 0.055] },
            { key: 'bottom', position: [0, -height / 2 - 0.045, 0], size: [width + 0.14, 0.055] },
            { key: 'left', position: [-width / 2 - 0.045, 0, 0], size: [0.055, height + 0.14] },
            { key: 'right', position: [width / 2 + 0.045, 0, 0], size: [0.055, height + 0.14] },
          ].map((edge) => (
            <mesh key={edge.key} position={edge.position as [number, number, number]}>
              <planeGeometry args={edge.size as [number, number]} />
              <meshBasicMaterial color="#f3c56e" transparent opacity={0.9} />
            </mesh>
          ))}
        </group>
      ) : null}
      <mesh
        onClick={(event) => {
          if (!interactive) return
          event.stopPropagation()
          onSelect(sticker.instance.id)
        }}
        onPointerDown={(event) => {
          if (!interactive) return
          event.stopPropagation()
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
