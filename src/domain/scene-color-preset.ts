export const MAX_SCENE_COLOR_PRESET_NAME_LENGTH = 24

export const SCENE_COLOR_KEYS = [
  'background',
  'deskFrame',
  'deskInset',
  'deskLegs',
  'deskTop',
  'matBinding',
  'matField',
  'notebookCover',
  'notebookJoint',
] as const

export type SceneColorKey = typeof SCENE_COLOR_KEYS[number]

export type SceneColorConfig = Record<SceneColorKey, string>

export type SceneColorPreviewMimeType = 'image/png' | 'image/webp'

export interface SceneColorPreset {
  id: string
  name: string
  colors: SceneColorConfig
  previewBlob?: Blob
  previewMimeType?: SceneColorPreviewMimeType
  createdAt: string
  updatedAt: string
}

export interface SceneColorPresetPreview {
  blob: Blob
  mimeType: SceneColorPreviewMimeType
}

export interface SceneColorPresetRepository {
  list(): Promise<SceneColorPreset[]>
  create(
    name: string,
    colors: SceneColorConfig,
    preview?: SceneColorPresetPreview,
  ): Promise<SceneColorPreset>
  delete(id: string): Promise<void>
}

export class SceneColorPresetValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SceneColorPresetValidationError'
  }
}

export class SceneColorPresetNameConflictError extends Error {
  constructor() {
    super('已经有同名预设，请使用其他名称。')
    this.name = 'SceneColorPresetNameConflictError'
  }
}

const HEX_COLOR = /^#[0-9a-f]{6}$/i

export const normalizeSceneColorPresetName = (name: string) => {
  const normalized = name.trim().replace(/\s+/g, ' ')
  if (!normalized) {
    throw new SceneColorPresetValidationError('请输入预设名称。')
  }
  if (normalized.length > MAX_SCENE_COLOR_PRESET_NAME_LENGTH) {
    throw new SceneColorPresetValidationError(
      `预设名称不能超过 ${MAX_SCENE_COLOR_PRESET_NAME_LENGTH} 个字符。`,
    )
  }
  return normalized
}

export const normalizeSceneColors = (colors: SceneColorConfig): SceneColorConfig => {
  const normalized = {} as SceneColorConfig
  for (const key of SCENE_COLOR_KEYS) {
    const value = colors[key]
    if (!HEX_COLOR.test(value)) {
      throw new SceneColorPresetValidationError('颜色预设包含无效的 HEX 参数。')
    }
    normalized[key] = value.toLowerCase()
  }
  return normalized
}

export const sceneColorsEqual = (left: SceneColorConfig, right: SceneColorConfig) =>
  SCENE_COLOR_KEYS.every((key) => left[key].toLowerCase() === right[key].toLowerCase())

