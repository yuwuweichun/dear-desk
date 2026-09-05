import { describe, expect, it } from 'vitest'

import { STICKER_MAX_EDGE } from '../domain/sticker'
import { STUDY_ROOM_MODEL_SPEC } from './models/model-specs'
import {
  wallStickerPositionFromWorld,
  wallStickerPositionToWorld,
} from './wall-sticker-layout'

describe('wall sticker layout', () => {
  it('keeps decorations inside the wall and outside the window at every rotation', () => {
    const clearance = STICKER_MAX_EDGE / Math.SQRT2
    const safe = wallStickerPositionFromWorld({ x: 0, y: 5 })
    expect(safe).not.toBeNull()
    const world = wallStickerPositionToWorld(safe!)
    expect(Math.abs(world.x)).toBeGreaterThanOrEqual(
      STUDY_ROOM_MODEL_SPEC.window.width / 2 +
        STUDY_ROOM_MODEL_SPEC.window.frameWidth / 2 +
        clearance,
    )

    const edge = wallStickerPositionToWorld({ x: -1, y: 2 })
    expect(edge.x).toBeCloseTo(-STUDY_ROOM_MODEL_SPEC.interior.width / 2 + clearance)
    expect(edge.y).toBeCloseTo(STUDY_ROOM_MODEL_SPEC.wallTopY - clearance)

    const large = wallStickerPositionToWorld({ x: -1, y: 2 }, 2)
    expect(large.x).toBeCloseTo(
      -STUDY_ROOM_MODEL_SPEC.interior.width / 2 + clearance * 2,
    )
    expect(wallStickerPositionToWorld({ x: -1, y: 2 }, 5).x).toBeCloseTo(
      -STUDY_ROOM_MODEL_SPEC.interior.width / 2 + (clearance * 5),
    )
  })
})
