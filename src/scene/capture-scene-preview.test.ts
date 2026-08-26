import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  captureScenePreview,
  SCENE_PREVIEW_HEIGHT,
  SCENE_PREVIEW_WIDTH,
} from './capture-scene-preview'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('captureScenePreview', () => {
  it('center-crops into a WebP thumbnail before returning the Blob', async () => {
    const drawImage = vi.fn()
    const preview = new Blob(['webp'], { type: 'image/webp' })
    const target = {
      width: 0,
      height: 0,
      getContext: vi.fn(() => ({ drawImage })),
      toBlob: vi.fn((callback: BlobCallback, mimeType: string) => {
        callback(mimeType === 'image/webp' ? preview : null)
      }),
    } as unknown as HTMLCanvasElement
    vi.spyOn(document, 'createElement').mockReturnValue(target)
    const source = { width: 1000, height: 1000 } as HTMLCanvasElement

    await expect(captureScenePreview(source)).resolves.toEqual({
      blob: preview,
      mimeType: 'image/webp',
    })
    expect(SCENE_PREVIEW_WIDTH).toBe(640)
    expect(SCENE_PREVIEW_HEIGHT).toBe(360)
    expect(target.width).toBe(SCENE_PREVIEW_WIDTH)
    expect(target.height).toBe(SCENE_PREVIEW_HEIGHT)
    expect(drawImage).toHaveBeenCalledWith(
      source,
      0,
      218.75,
      1000,
      562.5,
      0,
      0,
      SCENE_PREVIEW_WIDTH,
      SCENE_PREVIEW_HEIGHT,
    )
  })

  it('falls back to PNG when WebP encoding is unavailable', async () => {
    const png = new Blob(['png'], { type: 'image/png' })
    const target = {
      width: 0,
      height: 0,
      getContext: vi.fn(() => ({ drawImage: vi.fn() })),
      toBlob: vi.fn((callback: BlobCallback, mimeType: string) => {
        callback(mimeType === 'image/png' ? png : null)
      }),
    } as unknown as HTMLCanvasElement
    vi.spyOn(document, 'createElement').mockReturnValue(target)

    await expect(captureScenePreview({ width: 1600, height: 900 } as HTMLCanvasElement))
      .resolves.toEqual({ blob: png, mimeType: 'image/png' })
  })
})
