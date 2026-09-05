import {
  clampWallStickerPosition,
  normalizeStickerScale,
  STICKER_MAX_EDGE,
  WALL_STICKER_SCALE_MAX,
  type WallStickerPosition,
} from '../domain/sticker'
import { STUDY_ROOM_MODEL_SPEC } from './models/model-specs'

interface Point {
  x: number
  y: number
}

interface Rect {
  minX: number
  maxX: number
  minY: number
  maxY: number
}

const wallWidth = STUDY_ROOM_MODEL_SPEC.interior.width
const wallHeight = STUDY_ROOM_MODEL_SPEC.wallTopY - STUDY_ROOM_MODEL_SPEC.floorTopY
export const WALL_STICKER_Z = -STUDY_ROOM_MODEL_SPEC.interior.depth / 2 + 0.015

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(Number.isFinite(value) ? value : 0, min), max)

const inside = (point: Point, rect: Rect) =>
  point.x > rect.minX && point.x < rect.maxX && point.y > rect.minY && point.y < rect.maxY

const insideOrOn = (point: Point, rect: Rect) =>
  point.x >= rect.minX && point.x <= rect.maxX && point.y >= rect.minY && point.y <= rect.maxY

const nearestSafePoint = (point: Point, scale = 1) => {
  const clearance =
    (STICKER_MAX_EDGE * normalizeStickerScale(scale, WALL_STICKER_SCALE_MAX)) /
    Math.SQRT2
  const wallRect: Rect = {
    minX: -wallWidth / 2 + clearance,
    maxX: wallWidth / 2 - clearance,
    minY: STUDY_ROOM_MODEL_SPEC.floorTopY + clearance,
    maxY: STUDY_ROOM_MODEL_SPEC.wallTopY - clearance,
  }
  const windowRect: Rect = {
    minX: STUDY_ROOM_MODEL_SPEC.window.centerX - STUDY_ROOM_MODEL_SPEC.window.width / 2 - STUDY_ROOM_MODEL_SPEC.window.frameWidth / 2 - clearance,
    maxX: STUDY_ROOM_MODEL_SPEC.window.centerX + STUDY_ROOM_MODEL_SPEC.window.width / 2 + STUDY_ROOM_MODEL_SPEC.window.frameWidth / 2 + clearance,
    minY: STUDY_ROOM_MODEL_SPEC.window.bottomY - STUDY_ROOM_MODEL_SPEC.window.frameWidth / 2 - clearance,
    maxY: STUDY_ROOM_MODEL_SPEC.window.topY + STUDY_ROOM_MODEL_SPEC.window.frameWidth / 2 + clearance,
  }
  const bounded = {
    x: clamp(point.x, wallRect.minX, wallRect.maxX),
    y: clamp(point.y, wallRect.minY, wallRect.maxY),
  }
  if (!inside(bounded, windowRect)) return bounded

  return [
    { x: windowRect.minX, y: bounded.y },
    { x: windowRect.maxX, y: bounded.y },
    { x: bounded.x, y: windowRect.minY },
    { x: bounded.x, y: windowRect.maxY },
  ]
    .filter((candidate) => insideOrOn(candidate, wallRect) && !inside(candidate, windowRect))
    .sort((left, right) =>
      (left.x - point.x) ** 2 + (left.y - point.y) ** 2 -
      ((right.x - point.x) ** 2 + (right.y - point.y) ** 2),
    )[0] ?? null
}

export const wallStickerPositionFromWorld = (
  point: Point,
  scale = 1,
): WallStickerPosition | null => {
  const safe = nearestSafePoint(point, scale)
  if (!safe) return null
  return clampWallStickerPosition({
    x: (safe.x + wallWidth / 2) / wallWidth,
    y: (safe.y - STUDY_ROOM_MODEL_SPEC.floorTopY) / wallHeight,
  })
}

export const wallStickerPositionToWorld = (
  position: WallStickerPosition,
  scale = 1,
): Point => {
  const normalized = clampWallStickerPosition(position)
  return nearestSafePoint({
    x: normalized.x * wallWidth - wallWidth / 2,
    y: STUDY_ROOM_MODEL_SPEC.floorTopY + normalized.y * wallHeight,
  }, scale) ?? {
    x: 0,
    y:
      STUDY_ROOM_MODEL_SPEC.floorTopY +
      (STICKER_MAX_EDGE * normalizeStickerScale(scale, WALL_STICKER_SCALE_MAX)) /
        Math.SQRT2,
  }
}

export const WALL_HIT_SURFACE = {
  height: wallHeight,
  width: wallWidth,
  y: (STUDY_ROOM_MODEL_SPEC.floorTopY + STUDY_ROOM_MODEL_SPEC.wallTopY) / 2,
} as const
