import {
  DEFAULT_HISTORICAL_ENTRY_TITLE,
  normalizeEntryText,
  normalizeEntryTitle,
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

  async listDates() {
    const keys = await this.db.dailyEntries.orderBy('date').primaryKeys()
    return keys.filter((key): key is LocalDate => typeof key === 'string')
  }

  async listEntries() {
    return this.db.dailyEntries.orderBy('date').toArray()
  }

  async save(
    date: LocalDate,
    text: string,
    title = DEFAULT_HISTORICAL_ENTRY_TITLE,
  ): Promise<DailyEntry> {
    const normalizedText = normalizeEntryText(text)
    const normalizedTitle = normalizeEntryTitle(title)

    return this.db.transaction('rw', this.db.dailyEntries, async () => {
      const existing = await this.db.dailyEntries.get(date)
      const timestamp = this.now().toISOString()
      const entry: DailyEntry = {
        date,
        title: normalizedTitle,
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
