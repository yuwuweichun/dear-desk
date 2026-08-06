import {
  normalizeEntryText,
  type DailyEntry,
  type DailyEntryRepository,
  type LocalDate,
} from '../domain/daily-entry'
import { database, type DearDeskDatabase } from './database'

export class DexieDailyEntryRepository implements DailyEntryRepository {
  constructor(
    private readonly db: DearDeskDatabase = database,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async getByDate(date: LocalDate) {
    return (await this.db.dailyEntries.get(date)) ?? null
  }

  async save(date: LocalDate, text: string): Promise<DailyEntry> {
    const normalizedText = normalizeEntryText(text)

    return this.db.transaction('rw', this.db.dailyEntries, async () => {
      const existing = await this.db.dailyEntries.get(date)
      const timestamp = this.now().toISOString()
      const entry: DailyEntry = {
        date,
        text: normalizedText,
        createdAt: existing?.createdAt ?? timestamp,
        updatedAt: timestamp,
      }

      await this.db.dailyEntries.put(entry)
      return entry
    })
  }
}

export const dailyEntryRepository = new DexieDailyEntryRepository()
