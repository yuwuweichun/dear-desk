import 'fake-indexeddb/auto'

import { afterEach, describe, expect, it } from 'vitest'

import type { LocalDate } from '../domain/daily-entry'
import { DearDeskDatabase } from './database'
import { DexieDailyEntryRepository } from './daily-entry-repository'

const date = '2026-08-06' as LocalDate

describe('DexieDailyEntryRepository', () => {
  let database: DearDeskDatabase | undefined

  afterEach(async () => {
    if (database) {
      database.close()
      await database.delete()
      database = undefined
    }
  })

  it('creates and then updates one entry per local date', async () => {
    database = new DearDeskDatabase(`dear-desk-test-${crypto.randomUUID()}`)
    const timestamps = [
      new Date('2026-08-06T01:00:00.000Z'),
      new Date('2026-08-06T02:00:00.000Z'),
    ]
    const repository = new DexieDailyEntryRepository(
      database,
      () => timestamps.shift() ?? new Date(),
    )

    const created = await repository.save(date, ' 第一次记录 ')
    const updated = await repository.save(date, '第二次记录')

    expect(created).toEqual({
      date,
      text: '第一次记录',
      createdAt: '2026-08-06T01:00:00.000Z',
      updatedAt: '2026-08-06T01:00:00.000Z',
    })
    expect(updated.createdAt).toBe(created.createdAt)
    expect(updated.updatedAt).toBe('2026-08-06T02:00:00.000Z')
    await expect(repository.getByDate(date)).resolves.toEqual(updated)
    await expect(repository.listDates()).resolves.toEqual([date])
    await expect(database.dailyEntries.count()).resolves.toBe(1)
  })
})
