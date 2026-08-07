import {
  clampStickerPosition,
  normalizeStickerRotation,
  STICKER_FORGE_COMMIT,
  type PlacedSticker,
  type StickerDraft,
  type StickerInstance,
  type StickerPosition,
  type StickerRepository,
} from '../domain/sticker'
import { database, type DearDeskDatabase } from './database'

export class DexieStickerRepository implements StickerRepository {
  constructor(
    private readonly db: DearDeskDatabase = database,
    private readonly now: () => Date = () => new Date(),
    private readonly createId: () => string = () => crypto.randomUUID(),
  ) {}

  async list(): Promise<PlacedSticker[]> {
    const instances = (await this.db.stickerInstances.toArray()).sort((left, right) =>
      left.createdAt.localeCompare(right.createdAt),
    )
    const stickers = await Promise.all(
      instances.map(async (instance) => {
        const definition = await this.db.stickerDefinitions.get(instance.definitionId)
        if (!definition) return null
        const asset = await this.db.stickerRenderAssets.get(
          definition.previewAssetId,
        )
        return asset ? { asset, definition, instance } : null
      }),
    )
    return stickers.filter((sticker): sticker is PlacedSticker => sticker !== null)
  }

  async create(
    draft: StickerDraft,
    position: StickerPosition,
  ): Promise<PlacedSticker> {
    const definitionId = this.createId()
    const assetId = this.createId()
    const instanceId = this.createId()
    const timestamp = this.now().toISOString()
    const definition = {
      id: definitionId,
      kind: 'text' as const,
      source: draft.source,
      forge: draft.forge,
      previewAssetId: assetId,
      sourceEntryDate: draft.sourceEntryDate,
      createdAt: timestamp,
    }
    const asset = {
      id: assetId,
      ...draft.preview,
      upstreamCommit: STICKER_FORGE_COMMIT,
    }
    const instance: StickerInstance = {
      id: instanceId,
      definitionId,
      position: clampStickerPosition(position),
      rotationY: 0,
      createdAt: timestamp,
      updatedAt: timestamp,
    }

    await this.db.transaction(
      'rw',
      this.db.stickerDefinitions,
      this.db.stickerRenderAssets,
      this.db.stickerInstances,
      async () => {
        await this.db.stickerDefinitions.add(definition)
        await this.db.stickerRenderAssets.add(asset)
        await this.db.stickerInstances.add(instance)
      },
    )
    return { asset, definition, instance }
  }

  async move(
    instanceId: string,
    position: StickerPosition,
  ): Promise<StickerInstance> {
    return this.updateInstance(instanceId, {
      position: clampStickerPosition(position),
    })
  }

  async rotate(
    instanceId: string,
    rotationY: number,
  ): Promise<StickerInstance> {
    return this.updateInstance(instanceId, {
      rotationY: normalizeStickerRotation(rotationY),
    })
  }

  async delete(instanceId: string): Promise<void> {
    await this.db.transaction(
      'rw',
      this.db.stickerDefinitions,
      this.db.stickerRenderAssets,
      this.db.stickerInstances,
      async () => {
        const instance = await this.db.stickerInstances.get(instanceId)
        if (!instance) return
        const definition = await this.db.stickerDefinitions.get(
          instance.definitionId,
        )
        await this.db.stickerInstances.delete(instanceId)
        await this.db.stickerDefinitions.delete(instance.definitionId)
        if (definition) {
          await this.db.stickerRenderAssets.delete(definition.previewAssetId)
        }
      },
    )
  }

  private async updateInstance(
    instanceId: string,
    patch: Partial<Pick<StickerInstance, 'position' | 'rotationY'>>,
  ) {
    return this.db.transaction('rw', this.db.stickerInstances, async () => {
      const existing = await this.db.stickerInstances.get(instanceId)
      if (!existing) throw new Error('找不到这张贴纸。')
      const updated: StickerInstance = {
        ...existing,
        ...patch,
        updatedAt: this.now().toISOString(),
      }
      await this.db.stickerInstances.put(updated)
      return updated
    })
  }
}

export const stickerRepository = new DexieStickerRepository()
