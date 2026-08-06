import Dexie, { type EntityTable } from 'dexie'

import type { DailyEntry } from '../domain/daily-entry'

export class DearDeskDatabase extends Dexie {
  dailyEntries!: EntityTable<DailyEntry, 'date'>

  constructor(name = 'dear-desk') {
    super(name)

    this.version(1).stores({
      dailyEntries: 'date, updatedAt',
    })
  }
}

export const database = new DearDeskDatabase()
