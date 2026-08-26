import 'fake-indexeddb/auto'

import Dexie from 'dexie'
import { afterEach, describe, expect, it } from 'vitest'

import type { DailyEntry, LocalDate } from '../domain/daily-entry'
import type { SceneColorConfig } from '../domain/scene-color-preset'
import { DearDeskDatabase } from './database'
import { DexieSceneColorPresetRepository } from './scene-color-preset-repository'

const colors: SceneColorConfig = {
  background: '#d5dad8',
  deskFrame: '#593219',
  deskInset: '#70401f',
  deskLegs: '#593219',
  deskTop: '#73411f',
  matBinding: '#2d2c1e',
  matField: '#3e3b29',
  notebookCover: '#173f35',
  notebookJoint: '#0e2d27',
}

describe('DexieSceneColorPresetRepository', () => {
  let database: DearDeskDatabase | undefined

  afterEach(async () => {
    if (!database) return
    database.close()
    await database.delete()
    database = undefined
  })

  it('saves Blob previews, lists newest first, and deletes records', async () => {
    database = new DearDeskDatabase(`scene-colors-${crypto.randomUUID()}`)
    let time = 0
    const repository = new DexieSceneColorPresetRepository(
      database,
      () => new Date(`2026-08-25T09:0${time++}:00.000Z`),
      () => `preset-${time}`,
    )
    const preview = new Blob(['preview'], { type: 'image/webp' })
    const first = await repository.create('  雨天  ', colors, {
      blob: preview,
      mimeType: 'image/webp',
    })
    const second = await repository.create('夜晚', {
      ...colors,
      background: '#101820',
    })

    expect(first.name).toBe('雨天')
    expect(first.previewBlob).toEqual(preview)
    expect((await repository.list()).map((preset) => preset.id)).toEqual([
      second.id,
      first.id,
    ])
    await expect(repository.create('雨天', colors)).rejects.toThrow('同名预设')

    await repository.delete(first.id)
    await expect(repository.list()).resolves.toEqual([second])
  })

  it('upgrades v4 data without changing existing records', async () => {
    const name = `scene-colors-migration-${crypto.randomUUID()}`
    const legacy = new Dexie(name)
    legacy.version(4).stores({
      dailyEntries: 'date, updatedAt',
      stickerDefinitions: 'id, kind, createdAt',
      stickerInstances: 'id, surface, [surface+journalDate], definitionId, updatedAt',
      stickerRenderAssets: 'id, upstreamCommit',
      stickerSourceAssets: 'id, createdAt',
      notebookCoverSettings: 'id, updatedAt',
    })
    const entry: DailyEntry = {
      date: '2026-08-25' as LocalDate,
      text: '升级前的记录',
      createdAt: '2026-08-25T01:00:00.000Z',
      updatedAt: '2026-08-25T01:00:00.000Z',
    }
    await legacy.table('dailyEntries').add(entry)
    legacy.close()

    database = new DearDeskDatabase(name)
    await expect(database.dailyEntries.get(entry.date)).resolves.toEqual(entry)
    await expect(database.sceneColorPresets.count()).resolves.toBe(0)
    await new DexieSceneColorPresetRepository(database).create('第一个预设', colors)
    await expect(database.sceneColorPresets.count()).resolves.toBe(1)
  })
})

