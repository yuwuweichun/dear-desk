import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createNameplateText } from './nameplate-text'

describe('nameplate Text3D', () => {
  beforeEach(() => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      clearRect: vi.fn(),
      fillText: vi.fn(),
      measureText: vi.fn(() => ({ width: 420 })),
      restore: vi.fn(),
      save: vi.fn(),
      scale: vi.fn(),
      translate: vi.fn(),
    } as unknown as CanvasRenderingContext2D)
  })

  it('creates a centered bounded extruded mesh and supports an empty plate', () => {
    expect(createNameplateText('')).toBeNull()
    const mesh = createNameplateText('DEAR DESK')
    expect(mesh?.name).toBe('custom-nameplate-engraving')
    mesh?.geometry.computeBoundingBox()
    const bounds = mesh?.geometry.boundingBox
    expect(bounds).not.toBeNull()
    expect((bounds?.max.x ?? 0) - (bounds?.min.x ?? 0)).toBeLessThanOrEqual(1.09)
    expect(Math.abs((bounds?.min.x ?? 0) + (bounds?.max.x ?? 0))).toBeLessThan(0.01)
    expect(mesh?.material.metalness).toBeGreaterThan(0.8)
    mesh?.geometry.dispose()
    mesh?.material.dispose()
  })

  it('lays the Latin mesh on the plaque top plane', () => {
    const mesh = createNameplateText('DEAR')
    expect(mesh?.rotation.x).toBeCloseTo(-Math.PI / 2)
    expect(mesh?.material.color.getHexString()).toBe('b18a45')
    mesh?.geometry.dispose()
    mesh?.material.dispose()
  })
})
