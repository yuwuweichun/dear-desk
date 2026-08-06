import type {
  DailyEntry,
  DailyEntryRepository,
  LocalDate,
} from '../domain/daily-entry'
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
})
