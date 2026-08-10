import type { StickerMaterial } from '../domain/sticker'

const STICKER_FORGE_URL = '/vendor/sticker-forge/sticker-forge.es.js'
const browserImport = new Function(
  'url',
  'return import(url)',
) as (url: string) => Promise<unknown>

export interface ForgeTextSource {
  type: 'text'
  text: string
  color: string
  fontFamily: string
  fontWeight: number
}

export interface ForgeImageSource {
  type: 'image'
  src: string
  name?: string
}

export type ForgeSource = ForgeTextSource | ForgeImageSource

export interface ForgeAppearance {
  material: StickerMaterial
  materialIntensity: number
  outlineColor: string
  outlineWidth: number
}

interface ForgeOptions {
  source: ForgeSource
  material: { type: StickerMaterial; intensity: number; seed: number }
  outline: { color: string; width: number }
  peel: { release: 'reset' }
  sound: { enabled: boolean; volume: number }
  quality: 'medium'
}

interface ForgeState {
  dragging: boolean
  progress: number
  ready: boolean
}

interface ForgeInstance {
  destroy(): void
  getState(): Readonly<ForgeState>
  reset(): void
  setOptions(options: Partial<ForgeOptions>): void
  setSource(source: ForgeSource): Promise<void>
}

interface ForgeModule {
  createSticker(target: HTMLElement, options: ForgeOptions): Promise<ForgeInstance>
}

export interface StickerForgeSnapshot {
  blob: Blob
  height: number
  mimeType: 'image/png'
  width: number
}

export interface StickerForgeSession {
  capture(): Promise<StickerForgeSnapshot>
  destroy(): void
  setAppearance(appearance: ForgeAppearance): void
  setSource(source: ForgeSource): Promise<void>
}

const nextFrame = () =>
  new Promise<void>((resolve) => {
    let settled = false
    const finish = () => {
      if (settled) return
      settled = true
      window.clearTimeout(timeout)
      resolve()
    }
    const timeout = window.setTimeout(finish, 34)
    requestAnimationFrame(finish)
  })

const waitUntilFlat = async (instance: ForgeInstance) => {
  const deadline = performance.now() + 2500
  instance.reset()
  while (performance.now() < deadline) {
    const state = instance.getState()
    if (state.ready && !state.dragging && state.progress <= 0.001) {
      await nextFrame()
      return
    }
    await nextFrame()
  }
  throw new Error('贴纸尚未放平，请稍后重试。')
}

const canvasToBlob = (canvas: HTMLCanvasElement) =>
  new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob)
      else reject(new Error('无法生成贴纸快照。'))
    }, 'image/png')
  })

const cropTransparentCanvas = async (
  source: HTMLCanvasElement,
): Promise<StickerForgeSnapshot> => {
  const probe = document.createElement('canvas')
  probe.width = source.width
  probe.height = source.height
  const context = probe.getContext('2d', { willReadFrequently: true })
  if (!context) throw new Error('浏览器无法读取贴纸快照。')
  context.drawImage(source, 0, 0)
  const pixels = context.getImageData(0, 0, probe.width, probe.height).data
  let minX = probe.width
  let minY = probe.height
  let maxX = -1
  let maxY = -1
  for (let y = 0; y < probe.height; y += 1) {
    for (let x = 0; x < probe.width; x += 1) {
      if ((pixels[(y * probe.width + x) * 4 + 3] ?? 0) < 3) continue
      minX = Math.min(minX, x)
      minY = Math.min(minY, y)
      maxX = Math.max(maxX, x)
      maxY = Math.max(maxY, y)
    }
  }
  if (maxX < minX || maxY < minY) throw new Error('贴纸快照是空白的。')

  const padding = 8
  const cropX = Math.max(0, minX - padding)
  const cropY = Math.max(0, minY - padding)
  const cropWidth = Math.min(probe.width, maxX + padding + 1) - cropX
  const cropHeight = Math.min(probe.height, maxY + padding + 1) - cropY
  const cropped = document.createElement('canvas')
  cropped.width = cropWidth
  cropped.height = cropHeight
  const croppedContext = cropped.getContext('2d')
  if (!croppedContext) throw new Error('浏览器无法裁切贴纸快照。')
  croppedContext.drawImage(
    probe,
    cropX,
    cropY,
    cropWidth,
    cropHeight,
    0,
    0,
    cropWidth,
    cropHeight,
  )
  return {
    blob: await canvasToBlob(cropped),
    height: cropHeight,
    mimeType: 'image/png',
    width: cropWidth,
  }
}

export async function createStickerForgeSession(
  target: HTMLElement,
  source: ForgeSource,
  appearance: ForgeAppearance,
): Promise<StickerForgeSession> {
  // Keep the vendored public artifact outside Vite's module graph so dev mode
  // does not append its unsupported `?import` query to the upstream bundle.
  const module = (await browserImport(STICKER_FORGE_URL)) as ForgeModule
  const instance = await module.createSticker(target, {
    source,
    material: {
      type: appearance.material,
      intensity: appearance.materialIntensity,
      seed: 0.37,
    },
    outline: {
      color: appearance.outlineColor,
      width: appearance.outlineWidth,
    },
    peel: { release: 'reset' },
    sound: { enabled: true, volume: 0.45 },
    quality: 'medium',
  })
  let destroyed = false

  return {
    capture: async () => {
      if (destroyed) throw new Error('贴纸制作器已经关闭。')
      await waitUntilFlat(instance)
      const canvas = target.querySelector('canvas')
      if (!canvas) throw new Error('Sticker Forge 没有生成画布。')
      return cropTransparentCanvas(canvas)
    },
    destroy: () => {
      if (destroyed) return
      destroyed = true
      instance.destroy()
    },
    setAppearance: (nextAppearance) => {
      instance.setOptions({
        material: {
          type: nextAppearance.material,
          intensity: nextAppearance.materialIntensity,
          seed: 0.37,
        },
        outline: {
          color: nextAppearance.outlineColor,
          width: nextAppearance.outlineWidth,
        },
      })
    },
    setSource: (nextSource) => instance.setSource(nextSource),
  }
}
