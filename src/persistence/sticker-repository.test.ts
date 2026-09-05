import 'fake-indexeddb/auto'

import Dexie from 'dexie'
import { afterEach, describe, expect, it } from 'vitest'

import type { DailyEntry, LocalDate } from '../domain/daily-entry'
import {
  STICKER_BOUNDS,
  STICKER_FORGE_COMMIT,
  WALL_STICKER_SCALE_MAX,
  type ImageStickerDraft,
  type StickerDraft,
} from '../domain/sticker'
import { DearDeskDatabase } from './database'
import { DexieStickerRepository } from './sticker-repository'

const date = '2026-08-07' as LocalDate
const textDraft: StickerDraft = {
  kind: 'text',
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
    blob: new Blob(['preview'], { type: 'image/png' }),
    height: 80,
    mimeType: 'image/png',
    width: 120,
  },
}

const imageDraft: ImageStickerDraft = {
  kind: 'image',
  source: {
    asset: {
      blob: new Blob(['source'], { type: 'image/png' }),
      height: 600,
      mimeType: 'image/png',
      width: 800,
    },
    cutoutMode: 'automatic',
    name: '散步照片',
  },
  forge: textDraft.forge,
  preview: textDraft.preview,
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

  it('creates desk, journal and wall placements and queries each surface independently', async () => {
    database = new DearDeskDatabase(`sticker-test-${crypto.randomUUID()}`)
    let id = 0
    const repository = new DexieStickerRepository(
      database,
      () => new Date('2026-08-07T01:00:00.000Z'),
      () => `id-${++id}`,
    )

    const desk = await repository.create(textDraft, {
      surface: 'desk',
      position: { x: 99, z: -99 },
    })
    const journal = await repository.create(imageDraft, {
      surface: 'journal',
      journalDate: date,
      position: { x: 1.5, y: -0.5 },
    })
    const wall = await repository.create(textDraft, {
      surface: 'wall',
      position: { x: -1, y: 2 },
    })

    expect(desk.instance).toMatchObject({
      surface: 'desk',
      scale: 1,
      position: { x: STICKER_BOUNDS.maxX, z: STICKER_BOUNDS.minZ },
    })
    expect(journal.instance).toMatchObject({
      surface: 'journal',
      journalDate: date,
      position: { x: 1, y: 0 },
    })
    expect(wall.instance).toMatchObject({
      surface: 'wall',
      position: { x: 0, y: 1 },
    })
    await expect(repository.resize(wall.instance.id, 99)).resolves.toMatchObject({
      scale: WALL_STICKER_SCALE_MAX,
    })
    expect(desk.asset.upstreamCommit).toBe(STICKER_FORGE_COMMIT)
    await expect(repository.listDesk()).resolves.toHaveLength(1)
    await expect(repository.listJournal(date)).resolves.toHaveLength(1)
    await expect(repository.listWall()).resolves.toHaveLength(1)
    await expect(repository.listJournalDateCounts()).resolves.toEqual([
      { count: 1, date },
    ])
    await expect(repository.listJournalDates()).resolves.toEqual([date])
    await expect(repository.listJournal('2026-08-08' as LocalDate)).resolves.toEqual([])
    await expect(database.stickerSourceAssets.count()).resolves.toBe(1)

    await repository.delete(journal.instance.id)
    await expect(repository.listJournal(date)).resolves.toEqual([])
    await expect(repository.listJournalDates()).resolves.toEqual([])
    await expect(database.stickerSourceAssets.count()).resolves.toBe(0)
    await expect(database.stickerDefinitions.count()).resolves.toBe(2)
    await expect(database.stickerRenderAssets.count()).resolves.toBe(2)
  })

  it('moves, rotates, resizes and deletes a desk sticker transactionally', async () => {
    database = new DearDeskDatabase(`sticker-update-${crypto.randomUUID()}`)
    let id = 0
    const repository = new DexieStickerRepository(
      database,
      () => new Date('2026-08-07T01:00:00.000Z'),
      () => `id-${++id}`,
    )
    const created = await repository.create(textDraft, {
      surface: 'desk',
      position: { x: 0, z: 0 },
    })

    const moved = await repository.move(created.instance.id, { x: 1.2, z: 0.7 })
    const rotated = await repository.rotate(created.instance.id, -Math.PI / 2)
    const edgeMoved = await repository.move(created.instance.id, { x: 99, z: 99 })
    const resized = await repository.resize(created.instance.id, 99)
    expect(moved.position).toEqual({ x: 1.2, z: 0.7 })
    expect(rotated.rotationY).toBeCloseTo(Math.PI * 1.5)
    expect(edgeMoved.position).toEqual({
      x: STICKER_BOUNDS.maxX,
      z: STICKER_BOUNDS.maxZ,
    })
    expect(resized.scale).toBe(2)
    if (resized.surface !== 'desk') throw new Error('expected desk sticker')
    expect(resized.position.x).toBeLessThan(STICKER_BOUNDS.maxX)
    expect(resized.position.z).toBeLessThan(STICKER_BOUNDS.maxZ)

    await repository.delete(created.instance.id)
    await expect(repository.listDesk()).resolves.toEqual([])
    await expect(database.stickerDefinitions.count()).resolves.toBe(0)
    await expect(database.stickerRenderAssets.count()).resolves.toBe(0)
    await expect(database.stickerInstances.count()).resolves.toBe(0)
  })

  it('upgrades v2 desk stickers to the explicit desk surface', async () => {
    const name = `sticker-migration-${crypto.randomUUID()}`
    const legacy = new Dexie(name)
    legacy.version(2).stores({
      dailyEntries: 'date, updatedAt',
      stickerDefinitions: 'id, kind, sourceEntryDate, createdAt',
      stickerInstances: 'id, definitionId, updatedAt',
      stickerRenderAssets: 'id, upstreamCommit',
    })
    const entry: DailyEntry = {
      date,
      text: '迁移前记录',
      createdAt: '2026-08-07T01:00:00.000Z',
      updatedAt: '2026-08-07T01:00:00.000Z',
    }
    await legacy.table('dailyEntries').add(entry)
    await legacy.table('stickerDefinitions').add({
      id: 'definition-old',
      kind: 'text',
      source: textDraft.source,
      forge: textDraft.forge,
      previewAssetId: 'preview-old',
      sourceEntryDate: date,
      createdAt: entry.createdAt,
    })
    await legacy.table('stickerRenderAssets').add({
      id: 'preview-old',
      ...textDraft.preview,
      upstreamCommit: STICKER_FORGE_COMMIT,
    })
    await legacy.table('stickerInstances').add({
      id: 'instance-old',
      definitionId: 'definition-old',
      position: { x: 0.5, z: 0.2 },
      rotationY: 0,
      createdAt: entry.createdAt,
      updatedAt: entry.updatedAt,
    })
    legacy.close()

    database = new DearDeskDatabase(name)
    await expect(database.dailyEntries.get(date)).resolves.toEqual(entry)
    const migrated = await new DexieStickerRepository(database).listDesk()
    expect(migrated).toHaveLength(1)
    expect(migrated[0]?.instance).toMatchObject({
      id: 'instance-old',
      surface: 'desk',
      scale: 1,
      position: { x: 0.5, z: 0.2 },
    })
    await expect(database.stickerSourceAssets.count()).resolves.toBe(0)
  })

  it('skips instances with a missing definition reference', async () => {
    database = new DearDeskDatabase(`sticker-invalid-instance-${crypto.randomUUID()}`)
    await database.table('stickerInstances').bulkAdd([
      {
        id: 'instance-invalid',
        position: { x: 0, z: 0 },
        rotationY: 0,
        createdAt: '2026-08-07T01:00:00.000Z',
        updatedAt: '2026-08-07T01:00:00.000Z',
        surface: 'desk',
      },
      {
        id: 'instance-valid',
        definitionId: 'definition-valid',
        position: { x: 0, z: 0 },
        rotationY: 0,
        createdAt: '2026-08-07T01:00:01.000Z',
        updatedAt: '2026-08-07T01:00:01.000Z',
        surface: 'desk',
      },
    ])
    await database.stickerDefinitions.add({
      id: 'definition-valid',
      kind: 'text',
      source: textDraft.source,
      forge: textDraft.forge,
      previewAssetId: 'preview-valid',
      createdAt: '2026-08-07T01:00:01.000Z',
    })
    await database.stickerRenderAssets.add({
      id: 'preview-valid',
      ...textDraft.preview,
      upstreamCommit: STICKER_FORGE_COMMIT,
    })

    await expect(new DexieStickerRepository(database).listDesk()).resolves.toHaveLength(1)
  })

  it('skips definitions with a missing preview asset reference', async () => {
    database = new DearDeskDatabase(`sticker-invalid-definition-${crypto.randomUUID()}`)
    await database.table('stickerInstances').add({
      id: 'instance-invalid',
      definitionId: 'definition-invalid',
      position: { x: 0, z: 0 },
      rotationY: 0,
      createdAt: '2026-08-07T01:00:00.000Z',
      updatedAt: '2026-08-07T01:00:00.000Z',
      surface: 'desk',
    })
    await database.table('stickerDefinitions').add({
      id: 'definition-invalid',
      kind: 'text',
      source: textDraft.source,
      forge: textDraft.forge,
      createdAt: '2026-08-07T01:00:00.000Z',
    })

    await expect(new DexieStickerRepository(database).listDesk()).resolves.toEqual([])
  })
})
