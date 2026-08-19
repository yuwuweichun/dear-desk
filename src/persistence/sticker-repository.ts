import type { LocalDate } from '../domain/daily-entry'
import {
  clampJournalStickerPosition,
  clampStickerPosition,
  normalizeStickerRotation,
  STICKER_FORGE_COMMIT,
  type JournalStickerPosition,
  type PlacedSticker,
  type StickerDefinition,
  type StickerDraft,
  type StickerInstance,
  type StickerPlacement,
  type StickerPosition,
  type StickerRepository,
  type StickerSourceAsset,
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

  async listJournalDates(): Promise<LocalDate[]> {
    const instances = await this.db.stickerInstances
      .where('surface')
      .equals('journal')
      .toArray()
    return [...new Set(instances.flatMap((instance) =>
      instance.surface === 'journal' ? [instance.journalDate] : [],
    ))].sort((left, right) => left.localeCompare(right))
  }

  private async listInstances(
    query: Promise<StickerInstance[]>,
  ): Promise<PlacedSticker[]> {
    const instances = (await query).sort((left, right) =>
      left.createdAt.localeCompare(right.createdAt),
    )
    const stickers = await Promise.all(
      instances.map(async (instance) => {
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
        return asset ? { asset, definition, instance } : null
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
      createdAt: timestamp,
      updatedAt: timestamp,
    }
    const instance: StickerInstance =
      placement.surface === 'desk'
        ? {
            ...base,
            surface: 'desk',
            position: clampStickerPosition(placement.position),
          }
        : {
            ...base,
            surface: 'journal',
            journalDate: placement.journalDate,
            position: clampJournalStickerPosition(placement.position),
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
    position: StickerPosition | JournalStickerPosition,
  ): Promise<StickerInstance> {
    return this.db.transaction('rw', this.db.stickerInstances, async () => {
      const existing = await this.db.stickerInstances.get(instanceId)
      if (!existing) throw new Error('找不到这张贴纸。')
      const updated: StickerInstance =
        existing.surface === 'desk'
          ? {
              ...existing,
              position: clampStickerPosition(position as StickerPosition),
              updatedAt: this.now().toISOString(),
            }
          : {
              ...existing,
              position: clampJournalStickerPosition(
                position as JournalStickerPosition,
              ),
              updatedAt: this.now().toISOString(),
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
    patch: Pick<StickerInstance, 'rotationY'>,
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
