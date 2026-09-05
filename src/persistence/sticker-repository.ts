import type { LocalDate } from '../domain/daily-entry'
import {
  clampJournalStickerPosition,
  clampStickerPosition,
  clampWallStickerPosition,
  normalizeStickerRotation,
  normalizeStickerScale,
  STICKER_FORGE_COMMIT,
  WALL_STICKER_SCALE_MAX,
  type JournalStickerPosition,
  type PlacedSticker,
  type StickerDefinition,
  type StickerDraft,
  type StickerInstance,
  type StickerPlacement,
  type StickerPosition,
  type StickerRepository,
  type StickerSourceAsset,
  type WallStickerPosition,
} from '../domain/sticker'
import { database, type DearDeskDatabase } from './database'

export class DexieStickerRepository implements StickerRepository {
  constructor(
    private readonly db: DearDeskDatabase = database,
    private readonly now: () => Date = () => new Date(),
    private readonly createId: () => string = () => crypto.randomUUID(),
  ) {}

  listDesk(): Promise<PlacedSticker[]> {
    return this.listInstances(
      this.db.stickerInstances.where('surface').equals('desk').toArray(),
    )
  }

  listJournal(date: LocalDate): Promise<PlacedSticker[]> {
    return this.listInstances(
      this.db.stickerInstances
        .where('[surface+journalDate]')
        .equals(['journal', date])
        .toArray(),
    )
  }

  listWall(): Promise<PlacedSticker[]> {
    return this.listInstances(
      this.db.stickerInstances.where('surface').equals('wall').toArray(),
    )
  }

  async listJournalDates(): Promise<LocalDate[]> {
    return (await this.listJournalDateCounts()).map(({ date }) => date)
  }

  async listJournalDateCounts() {
    const instances = await this.db.stickerInstances
      .where('surface')
      .equals('journal')
      .toArray()
    const counts = new Map<LocalDate, number>()
    for (const instance of instances) {
      if (instance.surface !== 'journal') continue
      counts.set(instance.journalDate, (counts.get(instance.journalDate) ?? 0) + 1)
    }
    return [...counts]
      .map(([date, count]) => ({ count, date }))
      .sort((left, right) => left.date.localeCompare(right.date))
  }

  private async listInstances(
    query: Promise<StickerInstance[]>,
  ): Promise<PlacedSticker[]> {
    const instances = (await query).sort((left, right) =>
      left.createdAt.localeCompare(right.createdAt),
    )
    const stickers = await Promise.all(
      instances.map(async (instance): Promise<PlacedSticker | null> => {
        if (typeof instance.definitionId !== 'string' || !instance.definitionId) {
          return null
        }
        const definition = await this.db.stickerDefinitions.get(instance.definitionId)
        if (!definition) return null
        if (
          typeof definition.previewAssetId !== 'string' ||
          !definition.previewAssetId
        ) {
          return null
        }
        const asset = await this.db.stickerRenderAssets.get(
          definition.previewAssetId,
        )
        const normalizedInstance: StickerInstance = {
          ...instance,
              scale: normalizeStickerScale(
                instance.scale,
                instance.surface === 'wall' ? WALL_STICKER_SCALE_MAX : undefined,
              ),
        }
        return asset ? { asset, definition, instance: normalizedInstance } : null
      }),
    )
    return stickers.filter((sticker): sticker is PlacedSticker => sticker !== null)
  }

  async create(
    draft: StickerDraft,
    placement: StickerPlacement,
  ): Promise<PlacedSticker> {
    const definitionId = this.createId()
    const previewAssetId = this.createId()
    const instanceId = this.createId()
    const sourceAssetId = draft.kind === 'image' ? this.createId() : null
    const timestamp = this.now().toISOString()

    const definition: StickerDefinition =
      draft.kind === 'text'
        ? {
            id: definitionId,
            kind: 'text',
            source: draft.source,
            forge: draft.forge,
            previewAssetId,
            createdAt: timestamp,
          }
        : {
            id: definitionId,
            kind: 'image',
            source: {
              assetId: sourceAssetId as string,
              cutoutMode: draft.source.cutoutMode,
              name: draft.source.name,
            },
            forge: draft.forge,
            previewAssetId,
            createdAt: timestamp,
          }

    const sourceAsset: StickerSourceAsset | null =
      draft.kind === 'image'
        ? {
            id: sourceAssetId as string,
            ...draft.source.asset,
            createdAt: timestamp,
          }
        : null
    const asset = {
      id: previewAssetId,
      ...draft.preview,
      upstreamCommit: STICKER_FORGE_COMMIT,
    }
    const base = {
      id: instanceId,
      definitionId,
      rotationY: 0,
      scale: 1,
      createdAt: timestamp,
      updatedAt: timestamp,
    }
    let instance: StickerInstance
    switch (placement.surface) {
      case 'desk':
        instance = {
          ...base,
          surface: 'desk',
          position: clampStickerPosition(placement.position),
        }
        break
      case 'journal':
        instance = {
          ...base,
          surface: 'journal',
          journalDate: placement.journalDate,
          position: clampJournalStickerPosition(placement.position),
        }
        break
      case 'wall':
        instance = {
          ...base,
          surface: 'wall',
          position: clampWallStickerPosition(placement.position),
        }
        break
    }

    await this.db.transaction(
      'rw',
      this.db.stickerDefinitions,
      this.db.stickerRenderAssets,
      this.db.stickerSourceAssets,
      this.db.stickerInstances,
      async () => {
        if (sourceAsset) await this.db.stickerSourceAssets.add(sourceAsset)
        await this.db.stickerDefinitions.add(definition)
        await this.db.stickerRenderAssets.add(asset)
        await this.db.stickerInstances.add(instance)
      },
    )
    return { asset, definition, instance }
  }

  async move(
    instanceId: string,
    position: StickerPosition | JournalStickerPosition | WallStickerPosition,
  ): Promise<StickerInstance> {
    return this.db.transaction('rw', this.db.stickerInstances, async () => {
      const existing = await this.db.stickerInstances.get(instanceId)
      if (!existing) throw new Error('找不到这张贴纸。')
      let updated: StickerInstance
      switch (existing.surface) {
        case 'desk':
          updated = {
            ...existing,
            position: clampStickerPosition(position as StickerPosition, existing.scale),
            updatedAt: this.now().toISOString(),
          }
          break
        case 'journal':
          updated = {
            ...existing,
            position: clampJournalStickerPosition(position as JournalStickerPosition),
            updatedAt: this.now().toISOString(),
          }
          break
        case 'wall':
          updated = {
            ...existing,
            position: clampWallStickerPosition(position as WallStickerPosition),
            updatedAt: this.now().toISOString(),
          }
          break
      }
      await this.db.stickerInstances.put(updated)
      return updated
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

  async resize(instanceId: string, scale: number): Promise<StickerInstance> {
    return this.updateInstance(instanceId, { scale })
  }

  async delete(instanceId: string): Promise<void> {
    await this.db.transaction(
      'rw',
      this.db.stickerDefinitions,
      this.db.stickerRenderAssets,
      this.db.stickerSourceAssets,
      this.db.stickerInstances,
      async () => {
        const instance = await this.db.stickerInstances.get(instanceId)
        if (!instance) return
        const definition = await this.db.stickerDefinitions.get(
          instance.definitionId,
        )
        await this.db.stickerInstances.delete(instanceId)
        await this.db.stickerDefinitions.delete(instance.definitionId)
        if (!definition) return
        await this.db.stickerRenderAssets.delete(definition.previewAssetId)
        if (definition.kind === 'image') {
          await this.db.stickerSourceAssets.delete(definition.source.assetId)
        }
      },
    )
  }

  private async updateInstance(
    instanceId: string,
    patch: Partial<Pick<StickerInstance, 'rotationY' | 'scale'>>,
  ) {
    return this.db.transaction('rw', this.db.stickerInstances, async () => {
      const existing = await this.db.stickerInstances.get(instanceId)
      if (!existing) throw new Error('找不到这张贴纸。')
      const normalizedScale =
        patch.scale === undefined
          ? existing.scale
          : normalizeStickerScale(
              patch.scale,
              existing.surface === 'wall' ? WALL_STICKER_SCALE_MAX : undefined,
            )
      let updated: StickerInstance = {
        ...existing,
        ...patch,
        ...(normalizedScale === undefined ? {} : { scale: normalizedScale }),
        updatedAt: this.now().toISOString(),
      }
      if (updated.surface === 'desk') {
        updated = {
          ...updated,
          position: clampStickerPosition(updated.position, updated.scale),
        }
      }
      await this.db.stickerInstances.put(updated)
      return updated
    })
  }
}

export const stickerRepository = new DexieStickerRepository()
