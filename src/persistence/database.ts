import Dexie, { type EntityTable } from 'dexie'

import type { DailyEntry } from '../domain/daily-entry'
import type {
  StickerDefinition,
  StickerInstance,
  StickerRenderAsset,
} from '../domain/sticker'

export class DearDeskDatabase extends Dexie {
  dailyEntries!: EntityTable<DailyEntry, 'date'>
  stickerDefinitions!: EntityTable<StickerDefinition, 'id'>
  stickerInstances!: EntityTable<StickerInstance, 'id'>
  stickerRenderAssets!: EntityTable<StickerRenderAsset, 'id'>

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
  }
}

export const database = new DearDeskDatabase()
