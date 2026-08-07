import type {
  DailyEntry,
  DailyEntryRepository,
  LocalDate,
} from '../domain/daily-entry'
import type {
  PlacedSticker,
  StickerDraft,
  StickerRepository,
} from '../domain/sticker'
import { createAppStore } from './app-store'

const date = '2026-08-06' as LocalDate

const createRepository = (entry: DailyEntry | null = null): DailyEntryRepository => ({
  getByDate: vi.fn().mockResolvedValue(entry),
  save: vi.fn().mockImplementation(async (selectedDate, text) => ({
    date: selectedDate,
    text,
    createdAt: '2026-08-06T01:00:00.000Z',
    updatedAt: '2026-08-06T01:00:00.000Z',
  })),
})

const stickerDraft: StickerDraft = {
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

const placedSticker: PlacedSticker = {
  definition: {
    id: 'definition-1',
    kind: 'text',
    source: stickerDraft.source,
    forge: stickerDraft.forge,
    previewAssetId: 'asset-1',
    sourceEntryDate: date,
    createdAt: '2026-08-07T01:00:00.000Z',
  },
  asset: {
    id: 'asset-1',
    ...stickerDraft.preview,
    upstreamCommit: '068caa49eef69745564a5debbc01bab3fcd31042',
  },
  instance: {
    id: 'instance-1',
    definitionId: 'definition-1',
    position: { x: 0.5, z: 0.5 },
    rotationY: 0,
    createdAt: '2026-08-07T01:00:00.000Z',
    updatedAt: '2026-08-07T01:00:00.000Z',
  },
}

const createStickerRepository = (): StickerRepository => ({
  create: vi.fn().mockResolvedValue(placedSticker),
  delete: vi.fn().mockResolvedValue(undefined),
  list: vi.fn().mockResolvedValue([]),
  move: vi.fn().mockImplementation(async (_id, position) => ({
    ...placedSticker.instance,
    position,
  })),
  rotate: vi.fn().mockImplementation(async (_id, rotationY) => ({
    ...placedSticker.instance,
    rotationY,
  })),
})

describe('app store', () => {
  it('advances the notebook through one legal open and close sequence', () => {
    const store = createAppStore(createRepository(), date)

    store.getState().requestNotebookOpen()
    expect(store.getState().notebookPhase).toBe('approaching')

    store.getState().advanceNotebookPhase('approaching')
    expect(store.getState().notebookPhase).toBe('opening')

    store.getState().advanceNotebookPhase('opening')
    expect(store.getState().notebookPhase).toBe('editing')

    store.getState().requestNotebookClose()
    expect(store.getState().notebookPhase).toBe('closing')

    store.getState().advanceNotebookPhase('closing')
    expect(store.getState().notebookPhase).toBe('retreating')

    store.getState().advanceNotebookPhase('retreating')
    expect(store.getState().notebookPhase).toBe('desk')
  })

  it('ignores repeated or out-of-order transition requests', () => {
    const store = createAppStore(createRepository(), date)

    store.getState().requestNotebookOpen()
    store.getState().requestNotebookOpen()
    store.getState().advanceNotebookPhase('opening')
    store.getState().requestNotebookClose()

    expect(store.getState().notebookPhase).toBe('approaching')
  })

  it('settles interrupted transitions and supports the WebGL fallback', () => {
    const store = createAppStore(createRepository(), date)

    store.getState().requestNotebookOpen()
    store.getState().settleNotebookTransition()
    expect(store.getState().notebookPhase).toBe('editing')

    store.getState().requestNotebookClose()
    store.getState().settleNotebookTransition()
    expect(store.getState().notebookPhase).toBe('desk')

    store.getState().openNotebookWithoutScene()
    expect(store.getState().notebookPhase).toBe('editing')
  })

  it('loads and saves the selected local date through the repository', async () => {
    const repository = createRepository()
    const store = createAppStore(repository, date)

    await store.getState().loadToday()
    const saved = await store.getState().saveEntry('今天很好。')

    expect(saved).toBe(true)
    expect(repository.getByDate).toHaveBeenCalledWith(date)
    expect(repository.save).toHaveBeenCalledWith(date, '今天很好。')
    expect(store.getState()).toMatchObject({
      loadStatus: 'ready',
      saveStatus: 'saved',
      entry: { date, text: '今天很好。' },
    })
  })

  it('keeps the current entry and exposes a retryable error when saving fails', async () => {
    const existing: DailyEntry = {
      date,
      text: '原来的记录',
      createdAt: '2026-08-06T01:00:00.000Z',
      updatedAt: '2026-08-06T01:00:00.000Z',
    }
    const repository = createRepository(existing)
    vi.mocked(repository.save).mockRejectedValue(new Error('存储空间不足'))
    const store = createAppStore(repository, date)

    await store.getState().loadToday()
    const saved = await store.getState().saveEntry('新的记录')

    expect(saved).toBe(false)
    expect(store.getState()).toMatchObject({
      entry: existing,
      saveStatus: 'error',
      errorMessage: '存储空间不足',
    })
  })

  it('moves a short journal draft through composing, placement and persisted selection', async () => {
    const stickers = createStickerRepository()
    const store = createAppStore(createRepository(), date, stickers)
    store.getState().openNotebookWithoutScene()

    expect(store.getState().startStickerComposer('  今天很好  ')).toBe(true)
    expect(store.getState()).toMatchObject({
      notebookPhase: 'desk',
      stickerDraftText: '今天很好',
      stickerWorkflow: 'composing',
    })

    store.getState().prepareStickerPlacement(stickerDraft)
    await expect(store.getState().placePendingSticker({ x: 0.5, z: 0.5 })).resolves.toBe(
      true,
    )
    expect(stickers.create).toHaveBeenCalledWith(stickerDraft, { x: 0.5, z: 0.5 })
    expect(store.getState()).toMatchObject({
      pendingSticker: null,
      selectedStickerId: 'instance-1',
      stickerWorkflow: 'idle',
    })
  })

  it('restores the unsaved journal draft when sticker composing is canceled', () => {
    const store = createAppStore(createRepository(), date, createStickerRepository())
    store.getState().openNotebookWithoutScene()

    expect(store.getState().startStickerComposer('  移动端贴纸  ')).toBe(true)
    store.getState().cancelStickerComposer()

    expect(store.getState()).toMatchObject({
      notebookPhase: 'editing',
      stickerDraftText: '移动端贴纸',
      stickerWorkflow: 'idle',
    })
  })

  it('persists previewed movement, rotation and deletion for the selected sticker', async () => {
    const stickers = createStickerRepository()
    vi.mocked(stickers.list).mockResolvedValue([placedSticker])
    const store = createAppStore(createRepository(), date, stickers)
    await store.getState().loadStickers()
    store.getState().selectSticker('instance-1')

    store.getState().previewStickerPosition('instance-1', { x: 1.2, z: 0.8 })
    await store.getState().commitStickerPosition('instance-1', { x: 1.2, z: 0.8 })
    await store.getState().rotateSelectedSticker(1)
    await store.getState().deleteSelectedSticker()

    expect(stickers.move).toHaveBeenCalledWith('instance-1', { x: 1.2, z: 0.8 })
    expect(stickers.rotate).toHaveBeenCalledWith('instance-1', expect.any(Number))
    expect(stickers.delete).toHaveBeenCalledWith('instance-1')
    expect(store.getState().stickers).toEqual([])
    expect(store.getState().selectedStickerId).toBeNull()
  })
})
