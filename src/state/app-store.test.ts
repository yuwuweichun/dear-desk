import type {
  DailyEntry,
  DailyEntryRepository,
  LocalDate,
} from '../domain/daily-entry'
import type {
  PlacedSticker,
  StickerDraft,
  StickerPlacement,
  StickerRepository,
} from '../domain/sticker'
import { createAppStore } from './app-store'

const date = '2026-08-06' as LocalDate

const createRepository = (entry: DailyEntry | null = null): DailyEntryRepository => ({
  getByDate: vi.fn().mockResolvedValue(entry),
  listDates: vi.fn().mockResolvedValue(entry ? [entry.date] : []),
  save: vi.fn().mockImplementation(async (selectedDate, text) => ({
    date: selectedDate,
    text,
    createdAt: '2026-08-06T01:00:00.000Z',
    updatedAt: '2026-08-06T01:00:00.000Z',
  })),
})

const stickerDraft: StickerDraft = {
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
    blob: new Blob(['png'], { type: 'image/png' }),
    height: 80,
    mimeType: 'image/png',
    width: 120,
  },
}

const placedSticker = (placement: StickerPlacement): PlacedSticker => ({
  definition: {
    id: `definition-${placement.surface}`,
    kind: 'text',
    source: stickerDraft.kind === 'text' ? stickerDraft.source : neverSource(),
    forge: stickerDraft.forge,
    previewAssetId: `asset-${placement.surface}`,
    createdAt: '2026-08-07T01:00:00.000Z',
  },
  asset: {
    id: `asset-${placement.surface}`,
    ...stickerDraft.preview,
    upstreamCommit: '068caa49eef69745564a5debbc01bab3fcd31042',
  },
  instance:
    placement.surface === 'desk'
      ? {
          id: 'instance-desk',
          definitionId: 'definition-desk',
          surface: 'desk',
          position: placement.position,
          rotationY: 0,
          createdAt: '2026-08-07T01:00:00.000Z',
          updatedAt: '2026-08-07T01:00:00.000Z',
        }
      : {
          id: 'instance-journal',
          definitionId: 'definition-journal',
          surface: 'journal',
          journalDate: placement.journalDate,
          position: placement.position,
          rotationY: 0,
          createdAt: '2026-08-07T01:00:00.000Z',
          updatedAt: '2026-08-07T01:00:00.000Z',
        },
})

function neverSource(): never {
  throw new Error('unexpected image draft')
}

const deskSticker = placedSticker({ surface: 'desk', position: { x: 0.5, z: 0.5 } })
const journalSticker = placedSticker({
  surface: 'journal',
  journalDate: date,
  position: { x: 0.4, y: 0.3 },
})

const createStickerRepository = (): StickerRepository => ({
  create: vi.fn().mockImplementation(async (_draft, placement) => placedSticker(placement)),
  delete: vi.fn().mockResolvedValue(undefined),
  listDesk: vi.fn().mockResolvedValue([]),
  listJournal: vi.fn().mockResolvedValue([]),
  listJournalDates: vi.fn().mockResolvedValue([]),
  move: vi.fn().mockImplementation(async (id, position) => {
    const sticker = id === 'instance-journal' ? journalSticker : deskSticker
    return { ...sticker.instance, position } as typeof sticker.instance
  }),
  rotate: vi.fn().mockImplementation(async (id, rotationY) => {
    const sticker = id === 'instance-journal' ? journalSticker : deskSticker
    return { ...sticker.instance, rotationY }
  }),
})

describe('app store', () => {
  it('cycles one camera control through far, front, and near with a transition lock', () => {
    const store = createAppStore(createRepository(), date)
    expect(store.getState()).toMatchObject({
      deskCameraPreset: 'far',
      deskCameraTransitioning: false,
    })

    store.getState().cycleDeskCameraPreset()
    expect(store.getState()).toMatchObject({
      deskCameraPreset: 'front',
      deskCameraTransitioning: true,
    })
    store.getState().cycleDeskCameraPreset()
    expect(store.getState().deskCameraPreset).toBe('front')

    store.getState().settleDeskCameraPreset()
    store.getState().cycleDeskCameraPreset()
    store.getState().settleDeskCameraPreset()
    expect(store.getState().deskCameraPreset).toBe('near')

    store.getState().cycleDeskCameraPreset()
    expect(store.getState().deskCameraPreset).toBe('far')

    store.getState().settleDeskCameraPreset()
    store.getState().requestNotebookOpen()
    store.getState().cycleDeskCameraPreset()
    expect(store.getState().deskCameraPreset).toBe('far')
  })

  it('opens directly from near and preserves the selected preset across close', () => {
    const store = createAppStore(createRepository(), date)
    store.getState().cycleDeskCameraPreset()
    store.getState().settleDeskCameraPreset()
    store.getState().cycleDeskCameraPreset()
    store.getState().settleDeskCameraPreset()

    store.getState().requestNotebookOpen()
    expect(store.getState()).toMatchObject({
      deskCameraPreset: 'near',
      notebookPhase: 'opening',
    })
    store.getState().advanceNotebookPhase('opening')
    store.getState().requestNotebookClose()
    store.getState().advanceNotebookPhase('closing')
    store.getState().advanceNotebookPhase('retreating')
    expect(store.getState()).toMatchObject({
      deskCameraPreset: 'near',
      notebookPhase: 'desk',
    })
  })

  it('advances the notebook through one legal open and close sequence', () => {
    const store = createAppStore(createRepository(), date)
    store.getState().requestNotebookOpen()
    store.getState().advanceNotebookPhase('approaching')
    store.getState().advanceNotebookPhase('opening')
    expect(store.getState().notebookPhase).toBe('editing')
    store.getState().requestNotebookClose()
    store.getState().advanceNotebookPhase('closing')
    store.getState().advanceNotebookPhase('retreating')
    expect(store.getState().notebookPhase).toBe('desk')
  })

  it('loads text plus desk and current-date journal stickers independently', async () => {
    const stickers = createStickerRepository()
    vi.mocked(stickers.listDesk).mockResolvedValue([deskSticker])
    vi.mocked(stickers.listJournal).mockResolvedValue([journalSticker])
    const store = createAppStore(createRepository(), date, stickers)
    await Promise.all([store.getState().loadToday(), store.getState().loadStickers()])
    expect(stickers.listJournal).toHaveBeenCalledWith(date)
    expect(store.getState().stickers).toEqual([deskSticker])
    expect(store.getState().journalStickers).toEqual([journalSticker])
  })

  it('builds a dated journal sequence and locks overlapping page turns', async () => {
    const repository = createRepository()
    vi.mocked(repository.listDates).mockResolvedValue([
      '2026-08-06' as LocalDate,
    ])
    const stickers = createStickerRepository()
    vi.mocked(stickers.listJournalDates).mockResolvedValue([
      '2026-08-07' as LocalDate,
    ])
    const store = createAppStore(repository, '2026-08-08' as LocalDate, stickers)

    await store.getState().loadJournalPages()
    expect(store.getState()).toMatchObject({
      journalPageDates: ['2026-08-06', '2026-08-07', '2026-08-08'],
      journalCursor: 2,
      journalLoadStatus: 'ready',
    })

    const firstTurn = store.getState().requestJournalTurn('previous')
    await expect(store.getState().requestJournalTurn('previous')).resolves.toBe(false)
    await expect(firstTurn).resolves.toBe(true)
    expect(store.getState()).toMatchObject({
      journalPendingCursor: 1,
      journalTurnDirection: 'previous',
      journalTurnPhase: 'turning',
    })

    store.getState().settleJournalTurn()
    expect(store.getState()).toMatchObject({
      journalCursor: 1,
      journalTurnPhase: 'idle',
    })
    await expect(store.getState().requestJournalTurn('next')).resolves.toBe(true)
    store.getState().settleJournalTurn()
    expect(store.getState().journalCursor).toBe(2)
    await expect(store.getState().requestJournalTurn('next')).resolves.toBe(false)
  })

  it('opens the sticker workbench directly from the desk without a journal draft', () => {
    const store = createAppStore(createRepository(), date, createStickerRepository())
    store.getState().openStickerStudio()
    expect(store.getState()).toMatchObject({
      notebookPhase: 'desk',
      stickerWorkflow: 'composing',
      pendingSticker: null,
    })
    store.getState().cancelStickerComposer()
    expect(store.getState()).toMatchObject({ notebookPhase: 'desk', stickerWorkflow: 'idle' })
  })

  it('places the same prepared draft on the desk or current journal', async () => {
    const stickers = createStickerRepository()
    const store = createAppStore(createRepository(), date, stickers)
    store.getState().openStickerStudio()
    store.getState().prepareStickerPlacement(stickerDraft, 'desk')
    expect(store.getState().stickerWorkflow).toBe('placingDesk')
    await expect(store.getState().placePendingDeskSticker({ x: 0.5, z: 0.5 })).resolves.toBe(true)
    expect(stickers.create).toHaveBeenLastCalledWith(stickerDraft, {
      surface: 'desk',
      position: { x: 0.5, z: 0.5 },
    })

    store.getState().openStickerStudio()
    store.getState().prepareStickerPlacement(stickerDraft, 'journal')
    expect(store.getState()).toMatchObject({ notebookPhase: 'editing', stickerWorkflow: 'placingJournal' })
    await expect(store.getState().placePendingJournalSticker({ x: 0.25, y: 0.75 })).resolves.toBe(true)
    expect(stickers.create).toHaveBeenLastCalledWith(stickerDraft, {
      surface: 'journal',
      journalDate: date,
      position: { x: 0.25, y: 0.75 },
    })
  })

  it('persists movement, rotation and deletion for journal stickers', async () => {
    const stickers = createStickerRepository()
    vi.mocked(stickers.listJournal).mockResolvedValue([journalSticker])
    const store = createAppStore(createRepository(), date, stickers)
    await store.getState().loadStickers()
    store.getState().selectSticker('instance-journal')
    store.getState().previewJournalStickerPosition('instance-journal', { x: 1.2, y: -1 })
    expect(store.getState().journalStickers[0]?.instance.position).toEqual({ x: 1, y: 0 })
    await store.getState().commitJournalStickerPosition('instance-journal', { x: 0.7, y: 0.8 })
    await store.getState().rotateSelectedSticker(1)
    await store.getState().deleteSelectedSticker()
    expect(stickers.move).toHaveBeenCalledWith('instance-journal', { x: 0.7, y: 0.8 })
    expect(stickers.rotate).toHaveBeenCalledWith('instance-journal', expect.any(Number))
    expect(stickers.delete).toHaveBeenCalledWith('instance-journal')
    expect(store.getState().journalStickers).toEqual([])
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
    await expect(store.getState().saveEntry('新的记录')).resolves.toBe(false)
    expect(store.getState()).toMatchObject({
      entry: existing,
      saveStatus: 'error',
      errorMessage: '存储空间不足',
    })
  })

  it('saves an explicit historical date without replacing the today alias', async () => {
    const todayEntry: DailyEntry = {
      date,
      text: '今天的记录',
      createdAt: '2026-08-06T01:00:00.000Z',
      updatedAt: '2026-08-06T01:00:00.000Z',
    }
    const historicalDate = '2026-08-05' as LocalDate
    const repository = createRepository(todayEntry)
    const store = createAppStore(repository, date)
    await store.getState().loadToday()

    await expect(
      store.getState().saveJournalEntry(historicalDate, '改过的历史记录'),
    ).resolves.toBe(true)

    expect(repository.save).toHaveBeenCalledWith(historicalDate, '改过的历史记录')
    expect(store.getState().entry).toEqual(todayEntry)
    expect(store.getState().journalPageEntries[historicalDate]).toMatchObject({
      date: historicalDate,
      text: '改过的历史记录',
    })
  })
})
