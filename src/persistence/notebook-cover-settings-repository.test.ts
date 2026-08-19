import 'fake-indexeddb/auto'

import Dexie from 'dexie'
import { afterEach, describe, expect, it } from 'vitest'

import type { DailyEntry, LocalDate } from '../domain/daily-entry'
import { DearDeskDatabase } from './database'
import { DexieNotebookCoverSettingsRepository } from './notebook-cover-settings-repository'

describe('DexieNotebookCoverSettingsRepository', () => {
  let database: DearDeskDatabase | undefined

  afterEach(async () => {
    if (!database) return
    database.close()
    await database.delete()
    database = undefined
  })

  it('saves one normalized primary setting', async () => {
    database = new DearDeskDatabase(`nameplate-${crypto.randomUUID()}`)
    const repository = new DexieNotebookCoverSettingsRepository(
      database,
      () => new Date('2026-08-19T06:30:00.000Z'),
    )
    await expect(repository.get()).resolves.toBeNull()
    await expect(repository.save('  DEAR   DESK ')).resolves.toEqual({
      id: 'primary',
      label: 'DEAR DESK',
      updatedAt: '2026-08-19T06:30:00.000Z',
    })
    await expect(repository.get()).resolves.toMatchObject({ label: 'DEAR DESK' })
  })

  it('upgrades v3 data without changing the existing entry', async () => {
    const name = `nameplate-migration-${crypto.randomUUID()}`
    const legacy = new Dexie(name)
    legacy.version(3).stores({
      dailyEntries: 'date, updatedAt',
      stickerDefinitions: 'id, kind, createdAt',
      stickerInstances: 'id, surface, [surface+journalDate], definitionId, updatedAt',
      stickerRenderAssets: 'id, upstreamCommit',
      stickerSourceAssets: 'id, createdAt',
    })
    const entry: DailyEntry = {
      date: '2026-08-19' as LocalDate,
      text: '迁移前记录',
      createdAt: '2026-08-19T01:00:00.000Z',
      updatedAt: '2026-08-19T01:00:00.000Z',
    }
    await legacy.table('dailyEntries').add(entry)
    legacy.close()

    database = new DearDeskDatabase(name)
    await expect(database.dailyEntries.get(entry.date)).resolves.toEqual(entry)
    await expect(database.notebookCoverSettings.count()).resolves.toBe(0)
  })
})
