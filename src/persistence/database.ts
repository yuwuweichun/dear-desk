import Dexie, { type EntityTable } from 'dexie'

import type { DailyEntry } from '../domain/daily-entry'
import type {
  StickerDefinition,
  StickerInstance,
  StickerRenderAsset,
  StickerSourceAsset,
} from '../domain/sticker'

interface LegacyStickerInstance {
  id: string
  definitionId: string
  position: { x: number; z: number }
  rotationY: number
  createdAt: string
  updatedAt: string
  surface?: 'desk'
}

export class DearDeskDatabase extends Dexie {
  dailyEntries!: EntityTable<DailyEntry, 'date'>
  stickerDefinitions!: EntityTable<StickerDefinition, 'id'>
  stickerInstances!: EntityTable<StickerInstance, 'id'>
  stickerRenderAssets!: EntityTable<StickerRenderAsset, 'id'>
  stickerSourceAssets!: EntityTable<StickerSourceAsset, 'id'>

  constructor(name = 'dear-desk') {
    super(name)

    this.version(1).stores({
      dailyEntries: 'date, updatedAt',
    })

    this.version(2).stores({
      dailyEntries: 'date, updatedAt',
      stickerDefinitions: 'id, kind, sourceEntryDate, createdAt',
      stickerInstances: 'id, definitionId, updatedAt',
      stickerRenderAssets: 'id, upstreamCommit',
    })

    this.version(3)
      .stores({
        dailyEntries: 'date, updatedAt',
        stickerDefinitions: 'id, kind, createdAt',
        stickerInstances:
          'id, surface, [surface+journalDate], definitionId, updatedAt',
        stickerRenderAssets: 'id, upstreamCommit',
        stickerSourceAssets: 'id, createdAt',
      })
      .upgrade(async (transaction) => {
        await transaction
          .table<LegacyStickerInstance>('stickerInstances')
          .toCollection()
          .modify((instance) => {
            if (!instance.surface) instance.surface = 'desk'
          })
      })
  }
}

export const database = new DearDeskDatabase()
