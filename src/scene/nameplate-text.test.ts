import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  createNameplateText,
  disposeNameplateText,
} from './nameplate-text'

let canvasContext: CanvasRenderingContext2D

describe('nameplate Text3D', () => {
  beforeEach(() => {
    canvasContext = {
      clearRect: vi.fn(),
      fillRect: vi.fn(),
      fillText: vi.fn(),
      measureText: vi.fn(() => ({ width: 420 })),
      restore: vi.fn(),
      save: vi.fn(),
      scale: vi.fn(),
      strokeText: vi.fn(),
      translate: vi.fn(),
    } as unknown as CanvasRenderingContext2D
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(canvasContext)
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
    expect(mesh?.material.metalness).toBe(0.92)
    expect(mesh?.material.map?.name).toBe('nameplate-engraving-color')
    expect(mesh?.material.bumpMap?.name).toBe('nameplate-engraving-bump')
    expect(mesh?.material.roughnessMap?.name).toBe('nameplate-engraving-roughness')
    expect(mesh?.material.bumpScale).toBeGreaterThan(0)
    if (mesh) disposeNameplateText(mesh)
  })

  it('lays the Latin mesh on the plaque top plane', () => {
    const mesh = createNameplateText('DEAR', 'zhimang')
    expect(mesh?.rotation.x).toBeCloseTo(-Math.PI / 2)
    expect(mesh?.material.color.getHexString()).toBe('8f6a41')
    expect(mesh?.material.name).toBe('dynamic-engraved-brass-surface')
    expect(mesh?.userData).toMatchObject({
      contentFont: 'zhimang',
      engravingTechnique: 'bump-roughness',
    })
    expect(canvasContext.font).toContain('Zhi Mang Xing')
    if (mesh) disposeNameplateText(mesh)
  })

  it('disposes all dynamic engraving textures', () => {
    const mesh = createNameplateText('字', 'xuandong')!
    const material = mesh.material
    const colorDispose = vi.spyOn(material.map!, 'dispose')
    const bumpDispose = vi.spyOn(material.bumpMap!, 'dispose')
    const roughnessDispose = vi.spyOn(material.roughnessMap!, 'dispose')

    disposeNameplateText(mesh)

    expect(colorDispose).toHaveBeenCalledOnce()
    expect(bumpDispose).toHaveBeenCalledOnce()
    expect(roughnessDispose).toHaveBeenCalledOnce()
  })
})
