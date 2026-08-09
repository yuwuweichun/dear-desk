import {
  MAX_STICKER_IMAGE_BYTES,
  MAX_STICKER_IMAGE_SIDE,
  StickerValidationError,
} from '../domain/sticker'

export interface ProcessedImage {
  blob: Blob
  height: number
  mimeType: 'image/png'
  width: number
}

export interface BackgroundRemovalProgress {
  phase: 'loading' | 'processing'
  progress?: number
}

export interface BackgroundRemovalSession {
  cancel(): void
  destroy(): void
  remove(
    image: ProcessedImage,
    onProgress: (progress: BackgroundRemovalProgress) => void,
    signal?: AbortSignal,
  ): Promise<ProcessedImage>
}

interface RemovalWorkerMessage {
  id: number
  type: 'progress' | 'result' | 'error'
  phase?: 'loading' | 'processing'
  progress?: number
  message?: string
  pixels?: ArrayBuffer
  width?: number
  height?: number
}

interface PendingRemoval {
  id: number
  onProgress: (progress: BackgroundRemovalProgress) => void
  resolve: (image: ProcessedImage) => void
  reject: (error: unknown) => void
  signal?: AbortSignal
  abort: () => void
}

const acceptedTypes = new Set(['image/png', 'image/jpeg', 'image/webp'])

const canvasToBlob = (canvas: HTMLCanvasElement) =>
  new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob)
      else reject(new Error('浏览器无法生成 PNG 图片。'))
    }, 'image/png')
  })

export async function normalizeStickerImage(file: File): Promise<ProcessedImage> {
  if (!acceptedTypes.has(file.type)) {
    throw new StickerValidationError('请选择 PNG、JPEG 或 WebP 图片。')
  }
  if (file.size > MAX_STICKER_IMAGE_BYTES) {
    throw new StickerValidationError('图片不能超过 15 MB。')
  }

  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  } catch {
    throw new StickerValidationError('浏览器无法解码这张图片。')
  }
  try {
    const scale = Math.min(
      1,
      MAX_STICKER_IMAGE_SIDE / Math.max(bitmap.width, bitmap.height),
    )
    const width = Math.max(1, Math.round(bitmap.width * scale))
    const height = Math.max(1, Math.round(bitmap.height * scale))
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d')
    if (!context) throw new Error('浏览器无法处理图片。')
    context.drawImage(bitmap, 0, 0, width, height)
    return { blob: await canvasToBlob(canvas), height, mimeType: 'image/png', width }
  } finally {
    bitmap.close()
  }
}

let requestId = 0

const abortError = () => new DOMException('已取消自动抠图。', 'AbortError')

const imageFromPixels = async (
  pixels: ArrayBuffer,
  width: number,
  height: number,
): Promise<ProcessedImage> => {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  if (!context) throw new Error('浏览器无法生成抠图结果。')
  context.putImageData(
    new ImageData(new Uint8ClampedArray(pixels), width, height),
    0,
    0,
  )
  return {
    blob: await canvasToBlob(canvas),
    height,
    mimeType: 'image/png',
    width,
  }
}

export function createBackgroundRemovalSession(): BackgroundRemovalSession {
  let worker: Worker | null = null
  let pending: PendingRemoval | null = null
  let destroyed = false

  const cleanupPending = (request: PendingRemoval) => {
    request.signal?.removeEventListener('abort', request.abort)
    if (pending === request) pending = null
  }

  const terminateWorker = () => {
    worker?.terminate()
    worker = null
  }

  const abortPending = () => {
    const request = pending
    if (!request) return
    cleanupPending(request)
    terminateWorker()
    request.reject(abortError())
  }

  const handleMessage = async (message: RemovalWorkerMessage) => {
    const request = pending
    if (!request || message.id !== request.id) return
    if (message.type === 'progress' && message.phase) {
      request.onProgress({ phase: message.phase, progress: message.progress })
      return
    }
    if (message.type === 'error') {
      cleanupPending(request)
      request.reject(new Error(message.message ?? '自动抠图失败。'))
      return
    }
    if (
      message.type !== 'result' ||
      !message.pixels ||
      !message.width ||
      !message.height
    ) {
      return
    }
    try {
      const image = await imageFromPixels(
        message.pixels,
        message.width,
        message.height,
      )
      if (pending !== request || request.signal?.aborted) return
      cleanupPending(request)
      request.resolve(image)
    } catch (error) {
      if (pending !== request) return
      cleanupPending(request)
      request.reject(error)
    }
  }

  const ensureWorker = () => {
    if (worker) return worker
    const nextWorker = new Worker(
      new URL('./background-removal.worker.ts', import.meta.url),
      { type: 'module' },
    )
    nextWorker.addEventListener('message', (event) => {
      void handleMessage(event.data as RemovalWorkerMessage)
    })
    nextWorker.addEventListener('error', () => {
      const request = pending
      if (request) {
        cleanupPending(request)
        request.reject(new Error('自动抠图 worker 无法启动。'))
      }
      terminateWorker()
    })
    worker = nextWorker
    return nextWorker
  }

  return {
    cancel: abortPending,
    destroy: () => {
      if (destroyed) return
      destroyed = true
      abortPending()
      terminateWorker()
    },
    remove: async (image, onProgress, signal) => {
      if (destroyed) throw new Error('自动抠图会话已经关闭。')
      if (pending) throw new Error('自动抠图正在进行，请先取消。')
      if (signal?.aborted) throw abortError()

      const imageBuffer = await image.blob.arrayBuffer()
      if (signal?.aborted) throw abortError()
      if (destroyed) throw new Error('自动抠图会话已经关闭。')
      const activeWorker = ensureWorker()
      const id = ++requestId

      return new Promise<ProcessedImage>((resolve, reject) => {
        const abort = () => abortPending()
        const request: PendingRemoval = {
          id,
          onProgress,
          resolve,
          reject,
          signal,
          abort,
        }
        pending = request
        signal?.addEventListener('abort', abort, { once: true })
        if (signal?.aborted) {
          abortPending()
          return
        }
        activeWorker.postMessage(
          { id, type: 'remove', image: imageBuffer, mimeType: image.mimeType },
          [imageBuffer],
        )
      })
    },
  }
}

export const processedImageFromBlob = async (blob: Blob): Promise<ProcessedImage> => {
  const bitmap = await createImageBitmap(blob)
  const result = {
    blob,
    height: bitmap.height,
    mimeType: 'image/png' as const,
    width: bitmap.width,
  }
  bitmap.close()
  return result
}
