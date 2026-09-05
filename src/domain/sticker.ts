import type { LocalDate } from './daily-entry'

export const MAX_STICKER_TEXT_LENGTH = 60
export const MAX_STICKER_IMAGE_BYTES = 15 * 1024 * 1024
export const MAX_STICKER_IMAGE_SIDE = 4096
export const STICKER_ROTATION_STEP = Math.PI / 12
export const STICKER_MAX_EDGE = 1.72
export const STICKER_SCALE_MIN = 0.5
export const STICKER_SCALE_MAX = 2
export const WALL_STICKER_SCALE_MAX = 5
export const STICKER_SCALE_STEP = 0.25
export const STICKER_FORGE_COMMIT =
  '068caa49eef69745564a5debbc01bab3fcd31042' as const

const DESK_HALF_WIDTH = 6
const DESK_HALF_DEPTH = 4
const defaultStickerClearance = STICKER_MAX_EDGE / Math.SQRT2

export const STICKER_BOUNDS = {
  minX: -DESK_HALF_WIDTH + defaultStickerClearance,
  maxX: DESK_HALF_WIDTH - defaultStickerClearance,
  minZ: -DESK_HALF_DEPTH + defaultStickerClearance,
  maxZ: DESK_HALF_DEPTH - defaultStickerClearance,
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

export interface JournalStickerPosition {
  x: number
  y: number
}

export interface WallStickerPosition {
  x: number
  y: number
}

export interface TextStickerSource {
  text: string
  color: string
  fontFamily: string
  fontWeight: number
}

export type ImageCutoutMode = 'rectangle' | 'automatic' | 'manual'

export interface StickerSourceAsset {
  id: string
  blob: Blob
  mimeType: 'image/png'
  width: number
  height: number
  createdAt: string
}

interface StickerDefinitionBase {
  id: string
  forge: {
    material: StickerMaterial
    materialIntensity: number
    outlineWidth: number
    outlineColor: string
  }
  previewAssetId: string
  createdAt: string
}

export interface TextStickerDefinition extends StickerDefinitionBase {
  kind: 'text'
  source: TextStickerSource
}

export interface ImageStickerDefinition extends StickerDefinitionBase {
  kind: 'image'
  source: {
    assetId: string
    cutoutMode: ImageCutoutMode
    name: string
  }
}

export type StickerDefinition = TextStickerDefinition | ImageStickerDefinition

export interface StickerRenderAsset {
  id: string
  blob: Blob
  mimeType: 'image/png'
  width: number
  height: number
  upstreamCommit: typeof STICKER_FORGE_COMMIT
}

interface StickerInstanceBase {
  id: string
  definitionId: string
  rotationY: number
  scale?: number
  createdAt: string
  updatedAt: string
}

export interface DeskStickerInstance extends StickerInstanceBase {
  surface: 'desk'
  position: StickerPosition
}

export interface JournalStickerInstance extends StickerInstanceBase {
  surface: 'journal'
  journalDate: LocalDate
  position: JournalStickerPosition
}

export interface WallStickerInstance extends StickerInstanceBase {
  surface: 'wall'
  position: WallStickerPosition
}

export type StickerInstance =
  | DeskStickerInstance
  | JournalStickerInstance
  | WallStickerInstance

export interface PlacedSticker {
  definition: StickerDefinition
  asset: StickerRenderAsset
  instance: StickerInstance
}

export interface JournalStickerDateCount {
  count: number
  date: LocalDate
}

interface StickerDraftBase {
  forge: StickerDefinition['forge']
  preview: Pick<StickerRenderAsset, 'blob' | 'height' | 'mimeType' | 'width'>
}

export interface TextStickerDraft extends StickerDraftBase {
  kind: 'text'
  source: TextStickerSource
}

export interface ImageStickerDraft extends StickerDraftBase {
  kind: 'image'
  source: {
    asset: Pick<StickerSourceAsset, 'blob' | 'height' | 'mimeType' | 'width'>
    cutoutMode: ImageCutoutMode
    name: string
  }
}

export type StickerDraft = TextStickerDraft | ImageStickerDraft

export type StickerPlacement =
  | { surface: 'desk'; position: StickerPosition }
  | {
      surface: 'journal'
      journalDate: LocalDate
      position: JournalStickerPosition
    }
  | { surface: 'wall'; position: WallStickerPosition }

export interface StickerRepository {
  create(draft: StickerDraft, placement: StickerPlacement): Promise<PlacedSticker>
  delete(instanceId: string): Promise<void>
  listDesk(): Promise<PlacedSticker[]>
  listJournal(date: LocalDate): Promise<PlacedSticker[]>
  listWall(): Promise<PlacedSticker[]>
  listJournalDateCounts(): Promise<JournalStickerDateCount[]>
  listJournalDates(): Promise<LocalDate[]>
  move(instanceId: string, position: StickerInstance['position']): Promise<StickerInstance>
  rotate(instanceId: string, rotationY: number): Promise<StickerInstance>
  resize(instanceId: string, scale: number): Promise<StickerInstance>
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

export const normalizeStickerScale = (
  scale?: number,
  max = STICKER_SCALE_MAX,
) => {
  const value = scale ?? 1
  return Number.isFinite(value) ? clamp(value, STICKER_SCALE_MIN, max) : 1
}

export const clampStickerPosition = (
  position: StickerPosition,
  scale = 1,
): StickerPosition => ({
  x: clamp(
    position.x,
    -DESK_HALF_WIDTH + (STICKER_MAX_EDGE * normalizeStickerScale(scale)) / Math.SQRT2,
    DESK_HALF_WIDTH - (STICKER_MAX_EDGE * normalizeStickerScale(scale)) / Math.SQRT2,
  ),
  z: clamp(
    position.z,
    -DESK_HALF_DEPTH + (STICKER_MAX_EDGE * normalizeStickerScale(scale)) / Math.SQRT2,
    DESK_HALF_DEPTH - (STICKER_MAX_EDGE * normalizeStickerScale(scale)) / Math.SQRT2,
  ),
})

export const clampJournalStickerPosition = (
  position: JournalStickerPosition,
): JournalStickerPosition => ({
  x: clamp(position.x, 0, 1),
  y: clamp(position.y, 0, 1),
})

export const clampWallStickerPosition = (
  position: WallStickerPosition,
): WallStickerPosition => ({
  x: clamp(position.x, 0, 1),
  y: clamp(position.y, 0, 1),
})

export const normalizeStickerRotation = (rotationY: number) => {
  if (!Number.isFinite(rotationY)) return 0
  const fullTurn = Math.PI * 2
  return ((rotationY % fullTurn) + fullTurn) % fullTurn
}

export const stickerLabel = (definition: StickerDefinition) =>
  definition.kind === 'text' ? definition.source.text : definition.source.name
