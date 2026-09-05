import {
  clampJournalStickerPosition,
  clampStickerPosition,
  clampWallStickerPosition,
  MAX_STICKER_TEXT_LENGTH,
  normalizeStickerRotation,
  normalizeStickerScale,
  normalizeStickerText,
  STICKER_BOUNDS,
  WALL_STICKER_SCALE_MAX,
  StickerValidationError,
} from './sticker'

describe('sticker domain', () => {
  it('normalizes short text and rejects empty or oversized content', () => {
    expect(normalizeStickerText('  今天很好  ')).toBe('今天很好')
    expect(() => normalizeStickerText('   ')).toThrow(StickerValidationError)
    expect(() => normalizeStickerText('字'.repeat(MAX_STICKER_TEXT_LENGTH + 1))).toThrow(
      `贴纸文字不能超过 ${MAX_STICKER_TEXT_LENGTH} 个字符。`,
    )
  })

  it('clamps positions and wraps rotations into one full turn', () => {
    expect(clampJournalStickerPosition({ x: -1, y: 2 })).toEqual({ x: 0, y: 1 })
    expect(clampWallStickerPosition({ x: 2, y: -1 })).toEqual({ x: 1, y: 0 })
    expect(clampStickerPosition({ x: 99, z: -99 })).toEqual({
      x: STICKER_BOUNDS.maxX,
      z: STICKER_BOUNDS.minZ,
    })
    expect(clampStickerPosition({ x: 99, z: -99 }, 2).x).toBeLessThan(
      STICKER_BOUNDS.maxX,
    )
    expect(normalizeStickerScale(99)).toBe(2)
    expect(normalizeStickerScale(99, WALL_STICKER_SCALE_MAX)).toBe(5)
    expect(normalizeStickerScale(Number.NaN)).toBe(1)
    expect(normalizeStickerRotation(-Math.PI / 2)).toBeCloseTo(
      Math.PI * 1.5,
    )
    expect(normalizeStickerRotation(Math.PI * 4)).toBeCloseTo(0)
  })
})
