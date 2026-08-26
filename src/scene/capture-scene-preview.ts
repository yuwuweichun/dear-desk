import type {
  SceneColorPreviewMimeType,
  SceneColorPresetPreview,
} from '../domain/scene-color-preset'

export const SCENE_PREVIEW_WIDTH = 640
export const SCENE_PREVIEW_HEIGHT = 360

const canvasToBlob = (
  canvas: HTMLCanvasElement,
  mimeType: SceneColorPreviewMimeType,
  quality?: number,
) => new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, mimeType, quality))

export async function captureScenePreview(
  source: HTMLCanvasElement,
): Promise<SceneColorPresetPreview> {
  const target = document.createElement('canvas')
  target.width = SCENE_PREVIEW_WIDTH
  target.height = SCENE_PREVIEW_HEIGHT
  const context = target.getContext('2d')
  if (!context || source.width <= 0 || source.height <= 0) {
    throw new Error('当前场景无法生成预览。')
  }

  const sourceRatio = source.width / source.height
  const targetRatio = SCENE_PREVIEW_WIDTH / SCENE_PREVIEW_HEIGHT
  let sourceX = 0
  let sourceY = 0
  let sourceWidth = source.width
  let sourceHeight = source.height
  if (sourceRatio > targetRatio) {
    sourceWidth = source.height * targetRatio
    sourceX = (source.width - sourceWidth) / 2
  } else if (sourceRatio < targetRatio) {
    sourceHeight = source.width / targetRatio
    sourceY = (source.height - sourceHeight) / 2
  }

  context.drawImage(
    source,
    sourceX,
    sourceY,
    sourceWidth,
    sourceHeight,
    0,
    0,
    SCENE_PREVIEW_WIDTH,
    SCENE_PREVIEW_HEIGHT,
  )

  const webp = await canvasToBlob(target, 'image/webp', 0.82)
  if (webp?.type === 'image/webp') return { blob: webp, mimeType: 'image/webp' }
  const png = await canvasToBlob(target, 'image/png')
  if (png) return { blob: png, mimeType: 'image/png' }
  throw new Error('当前场景无法生成预览。')
}

export type CaptureScenePreview = () => Promise<SceneColorPresetPreview>
