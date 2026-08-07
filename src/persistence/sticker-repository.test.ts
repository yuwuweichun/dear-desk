import 'fake-indexeddb/auto'

import Dexie from 'dexie'
import { afterEach, describe, expect, it } from 'vitest'

import type { DailyEntry, LocalDate } from '../domain/daily-entry'
import {
  STICKER_BOUNDS,
  STICKER_FORGE_COMMIT,
  type StickerDraft,
} from '../domain/sticker'
import { DearDeskDatabase } from './database'
import { DexieStickerRepository } from './sticker-repository'

const date = '2026-08-07' as LocalDate
const draft: StickerDraft = {
  source: {
    text: '今天很好',
    color: '#19191d',
    fontFamily: 'Arial',
    fontWeight: 900,
  },
  forge: {
    material: 'original',
    materialIntensity: 0.86,
    outlineColor: '#ffffff',
    outlineWidth: 14,
  },
  preview: {
    blob: new Blob(['png'], { type: 'image/png' }),
    height: 80,
    mimeType: 'image/png',
    width: 120,
  },
  sourceEntryDate: date,
}

describe('DexieStickerRepository', () => {
  let database: DearDeskDatabase | undefined

  afterEach(async () => {
    if (database) {
      database.close()
      await database.delete()
      database = undefined
    }
  })

  it('creates, updates, lists and deletes all three sticker records transactionally', async () => {
    database = new DearDeskDatabase(`sticker-test-${crypto.randomUUID()}`)
    let id = 0
    const timestamps = [
      new Date('2026-08-07T01:00:00.000Z'),
      new Date('2026-08-07T02:00:00.000Z'),
      new Date('2026-08-07T03:00:00.000Z'),
    ]
    const repository = new DexieStickerRepository(
      database,
      () => timestamps.shift() ?? new Date('2026-08-07T04:00:00.000Z'),
      () => `id-${++id}`,
    )

    const created = await repository.create(draft, { x: 99, z: -99 })
    expect(created.instance.position).toEqual({
      x: STICKER_BOUNDS.maxX,
      z: STICKER_BOUNDS.minZ,
    })
    expect(created.asset.upstreamCommit).toBe(STICKER_FORGE_COMMIT)
    const listed = await repository.list()
    expect(listed).toHaveLength(1)
    expect(listed[0]).toMatchObject({
      definition: created.definition,
      instance: created.instance,
      asset: {
        id: created.asset.id,
        height: 80,
        mimeType: 'image/png',
        upstreamCommit: STICKER_FORGE_COMMIT,
        width: 120,
      },
    })

    const moved = await repository.move(created.instance.id, { x: 1.2, z: 0.7 })
    const rotated = await repository.rotate(created.instance.id, -Math.PI / 2)
    expect(moved.position).toEqual({ x: 1.2, z: 0.7 })
    expect(rotated.rotationY).toBeCloseTo(Math.PI * 1.5)

    await repository.delete(created.instance.id)
    await expect(repository.list()).resolves.toEqual([])
    await expect(database.stickerDefinitions.count()).resolves.toBe(0)
    await expect(database.stickerRenderAssets.count()).resolves.toBe(0)
    await expect(database.stickerInstances.count()).resolves.toBe(0)
  })

  it('upgrades a v1 database without changing its daily entry', async () => {
    const name = `sticker-migration-${crypto.randomUUID()}`
    const legacy = new Dexie(name)
    legacy.version(1).stores({ dailyEntries: 'date, updatedAt' })
    const entry: DailyEntry = {
      date,
      text: '迁移前记录',
      createdAt: '2026-08-07T01:00:00.000Z',
      updatedAt: '2026-08-07T01:00:00.000Z',
    }
    await legacy.table<DailyEntry>('dailyEntries').add(entry)
    legacy.close()

    database = new DearDeskDatabase(name)
    await expect(database.dailyEntries.get(date)).resolves.toEqual(entry)
    await expect(database.stickerDefinitions.count()).resolves.toBe(0)
    await expect(database.stickerInstances.count()).resolves.toBe(0)
    await expect(database.stickerRenderAssets.count()).resolves.toBe(0)
  })
})
