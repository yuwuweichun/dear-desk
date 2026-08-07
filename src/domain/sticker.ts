import type { LocalDate } from './daily-entry'

export const MAX_STICKER_TEXT_LENGTH = 60
export const STICKER_ROTATION_STEP = Math.PI / 12
export const STICKER_FORGE_COMMIT =
  '068caa49eef69745564a5debbc01bab3fcd31042' as const

export const STICKER_BOUNDS = {
  minX: -4.05,
  maxX: 4.05,
  minZ: -2.72,
  maxZ: 2.72,
} as const

export type StickerMaterial =
  | 'original'
  | 'holographic'
  | 'glitter'
  | 'reflective'

export interface StickerPosition {
  x: number
  z: number
}

export interface StickerDefinition {
  id: string
  kind: 'text'
  source: {
    text: string
    color: string
    fontFamily: string
    fontWeight: number
  }
  forge: {
    material: StickerMaterial
    materialIntensity: number
    outlineWidth: number
    outlineColor: string
  }
  previewAssetId: string
  sourceEntryDate: LocalDate
  createdAt: string
}

export interface StickerRenderAsset {
  id: string
  blob: Blob
  mimeType: 'image/png'
  width: number
  height: number
  upstreamCommit: typeof STICKER_FORGE_COMMIT
}

export interface StickerInstance {
  id: string
  definitionId: string
  position: StickerPosition
  rotationY: number
  createdAt: string
  updatedAt: string
}

export interface PlacedSticker {
  definition: StickerDefinition
  asset: StickerRenderAsset
  instance: StickerInstance
}

export interface StickerDraft {
  source: StickerDefinition['source']
  forge: StickerDefinition['forge']
  preview: Pick<StickerRenderAsset, 'blob' | 'height' | 'mimeType' | 'width'>
  sourceEntryDate: LocalDate
}

export interface StickerRepository {
  create(draft: StickerDraft, position: StickerPosition): Promise<PlacedSticker>
  delete(instanceId: string): Promise<void>
  list(): Promise<PlacedSticker[]>
  move(instanceId: string, position: StickerPosition): Promise<StickerInstance>
  rotate(instanceId: string, rotationY: number): Promise<StickerInstance>
}

export class StickerValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'StickerValidationError'
  }
}

export const normalizeStickerText = (text: string) => {
  const normalized = text.trim()
  if (!normalized) throw new StickerValidationError('请先写下贴纸文字。')
  if (normalized.length > MAX_STICKER_TEXT_LENGTH) {
    throw new StickerValidationError(
      `贴纸文字不能超过 ${MAX_STICKER_TEXT_LENGTH} 个字符。`,
    )
  }
  return normalized
}

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(Number.isFinite(value) ? value : 0, min), max)

export const clampStickerPosition = (
  position: StickerPosition,
): StickerPosition => ({
  x: clamp(position.x, STICKER_BOUNDS.minX, STICKER_BOUNDS.maxX),
  z: clamp(position.z, STICKER_BOUNDS.minZ, STICKER_BOUNDS.maxZ),
})

export const normalizeStickerRotation = (rotationY: number) => {
  if (!Number.isFinite(rotationY)) return 0
  const fullTurn = Math.PI * 2
  return ((rotationY % fullTurn) + fullTurn) % fullTurn
}
