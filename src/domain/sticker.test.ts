import {
  clampStickerPosition,
  MAX_STICKER_TEXT_LENGTH,
  normalizeStickerRotation,
  normalizeStickerText,
  STICKER_BOUNDS,
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
    expect(clampStickerPosition({ x: 99, z: -99 })).toEqual({
      x: STICKER_BOUNDS.maxX,
      z: STICKER_BOUNDS.minZ,
    })
    expect(normalizeStickerRotation(-Math.PI / 2)).toBeCloseTo(
      Math.PI * 1.5,
    )
    expect(normalizeStickerRotation(Math.PI * 4)).toBeCloseTo(0)
  })
})
