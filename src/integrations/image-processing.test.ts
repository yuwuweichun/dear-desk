import {
  MAX_STICKER_IMAGE_BYTES,
  StickerValidationError,
} from '../domain/sticker'
import { normalizeStickerImage } from './image-processing'

describe('image processing input', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })
  it('rejects unsupported formats and files over 15 MB before decoding', async () => {
    await expect(
      normalizeStickerImage(new File(['svg'], 'shape.svg', { type: 'image/svg+xml' })),
    ).rejects.toBeInstanceOf(StickerValidationError)
    await expect(
      normalizeStickerImage(
        new File([new Uint8Array(MAX_STICKER_IMAGE_BYTES + 1)], 'large.png', {
          type: 'image/png',
        }),
      ),
    ).rejects.toThrow('图片不能超过 15 MB。')
  })

  it('normalizes a decoded image to PNG with a longest side of 4096px', async () => {
    const close = vi.fn()
    vi.stubGlobal(
      'createImageBitmap',
      vi.fn().mockResolvedValue({ width: 8000, height: 4000, close }),
    )
    const drawImage = vi.fn()
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      drawImage,
    } as unknown as CanvasRenderingContext2D)
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((callback) => {
      callback(new Blob(['png'], { type: 'image/png' }))
    })

    const result = await normalizeStickerImage(
      new File(['jpeg'], 'photo.jpg', { type: 'image/jpeg' }),
    )

    expect(result).toMatchObject({ width: 4096, height: 2048, mimeType: 'image/png' })
    expect(drawImage).toHaveBeenCalled()
    expect(close).toHaveBeenCalled()
    vi.unstubAllGlobals()
  })
})
