import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import type { DailyEntry, DailyEntryRepository, LocalDate } from '../../domain/daily-entry'
import { createAppStore } from '../../state/app-store'
import { AppStoreProvider } from '../../state/app-store-context'
import { JournalPanel } from './JournalPanel'

const date = '2026-08-06' as LocalDate
const previousDate = '2026-08-05' as LocalDate

const dailyEntry = (entryDate: LocalDate, text: string): DailyEntry => ({
  date: entryDate,
  text,
  createdAt: `${entryDate}T01:00:00.000Z`,
  updatedAt: `${entryDate}T01:00:00.000Z`,
})

const createRepository = (
  entries: Partial<Record<LocalDate, DailyEntry>> = {},
): DailyEntryRepository => ({
  getByDate: vi.fn().mockImplementation(async (requestedDate: LocalDate) =>
    entries[requestedDate] ?? null),
  listDates: vi.fn().mockResolvedValue(Object.keys(entries) as LocalDate[]),
  save: vi.fn().mockImplementation(async (selectedDate: LocalDate, text: string) =>
    dailyEntry(selectedDate, text.trim())),
})

const openNotebook = (store: ReturnType<typeof createAppStore>) => {
  store.getState().requestNotebookOpen()
  store.getState().advanceNotebookPhase('approaching')
  store.getState().advanceNotebookPhase('opening')
}

const renderJournal = async (repository: DailyEntryRepository) => {
  const store = createAppStore(repository, date)
  openNotebook(store)
  const result = render(
    <AppStoreProvider store={store}>
      <JournalPanel />
    </AppStoreProvider>,
  )
  await waitFor(() => {
    expect(store.getState().journalLoadStatus).toBe('ready')
  })
  return { store, ...result }
}

const startWriting = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(screen.getByRole('button', {
    name: '当前为阅读模式，切换到编辑模式',
  }))
  await user.click(screen.getByRole('button', { name: '开始书写本页' }))
  return screen.getByRole('textbox', { name: '本页记录' })
}

describe('JournalPanel', () => {
  it('opens in reading mode with a blank left page and keeps the mode across turns', async () => {
    const repository = createRepository({
      [previousDate]: dailyEntry(previousDate, '上一页留下的内容'),
    })
    const user = userEvent.setup()
    const { container, store } = await renderJournal(repository)

    const modeToggle = screen.getByRole('button', {
      name: '当前为阅读模式，切换到编辑模式',
    })
    expect(modeToggle).toHaveAttribute('aria-pressed', 'false')
    expect(within(modeToggle).getByText('阅读')).toBeVisible()
    expect(within(modeToggle).getByText('编辑')).toBeVisible()
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    expect(container.querySelector('.journal-page-left')).toHaveTextContent('')

    await user.click(modeToggle)
    await user.click(screen.getByRole('button', { name: /上一页/ }))
    await waitFor(() => {
      expect(container.querySelector('.page-turn-sheet.is-previous')).toBeInTheDocument()
    })
    act(() => store.getState().settleJournalTurn())

    const rightPage = container.querySelector('.journal-page-right')
    expect(rightPage).not.toBeNull()
    expect(within(rightPage as HTMLElement).getByText('上一页留下的内容')).toBeVisible()
    expect(screen.getByRole('button', {
      name: '当前为编辑模式，切换到阅读模式',
    })).toHaveAttribute('aria-pressed', 'true')

    await user.click(screen.getByRole('button', { name: /下一页/ }))
    await waitFor(() => {
      expect(container.querySelector('.page-turn-sheet.is-next')).toBeInTheDocument()
    })
    act(() => store.getState().settleJournalTurn())

    expect(screen.getByRole('heading', { name: '今天' })).toBeVisible()
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
  })

  it('writes and saves today through the editing and writing controls', async () => {
    const repository = createRepository()
    const user = userEvent.setup()
    await renderJournal(repository)

    const textarea = await startWriting(user)
    await user.type(textarea, '今天把第一句话留在桌上。')
    await user.click(screen.getByRole('button', { name: '保存本页' }))

    await waitFor(() => {
      expect(repository.save).toHaveBeenCalledWith(date, '今天把第一句话留在桌上。')
    })
    expect(await screen.findByText('今天把第一句话留在桌上。')).toBeVisible()
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('已收笔，内容已存入本地。')
  })

  it('edits and saves a historical page without replacing todays entry alias', async () => {
    const repository = createRepository({
      [previousDate]: dailyEntry(previousDate, '旧句子'),
    })
    const user = userEvent.setup()
    const { container, store } = await renderJournal(repository)

    await user.click(screen.getByRole('button', { name: /上一页/ }))
    await waitFor(() => {
      expect(container.querySelector('.page-turn-sheet.is-previous')).toBeInTheDocument()
    })
    act(() => store.getState().settleJournalTurn())

    const textarea = await startWriting(user)
    expect(textarea).toHaveValue('旧句子')
    await user.clear(textarea)
    await user.type(textarea, '改过的旧句子')
    await user.click(screen.getByRole('button', { name: '保存本页' }))

    await waitFor(() => {
      expect(repository.save).toHaveBeenCalledWith(previousDate, '改过的旧句子')
    })
    expect(await screen.findByText('改过的旧句子')).toBeVisible()
    expect(store.getState().entry).toBeNull()
    expect(store.getState().journalPageEntries[previousDate]?.text).toBe('改过的旧句子')
  })

  it('keeps a failed draft visible for retry', async () => {
    const repository = createRepository()
    vi.mocked(repository.save).mockRejectedValue(new Error('这次没有保存成功'))
    const user = userEvent.setup()
    await renderJournal(repository)

    const textarea = await startWriting(user)
    await user.type(textarea, '不要丢掉这句话')
    await user.click(screen.getByRole('button', { name: '保存本页' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('这次没有保存成功')
    expect(screen.getByRole('textbox', { name: '本页记录' })).toHaveValue('不要丢掉这句话')
  })

  it('blocks page turns, reading mode, and close while a changed draft is open', async () => {
    const repository = createRepository({
      [previousDate]: dailyEntry(previousDate, '上一页'),
    })
    const user = userEvent.setup()
    const { store } = await renderJournal(repository)

    const textarea = await startWriting(user)
    await user.type(textarea, '未保存内容')

    await user.click(screen.getByRole('button', { name: /上一页/ }))
    expect(store.getState().journalTurnPhase).toBe('idle')
    expect(screen.getByRole('status')).toHaveTextContent('请先收笔，再翻页。')

    await user.click(screen.getByRole('button', {
      name: '当前为编辑模式，切换到阅读模式',
    }))
    expect(screen.getByRole('textbox', { name: '本页记录' })).toBeVisible()
    expect(screen.getByRole('status')).toHaveTextContent('请先收笔，再切回阅读。')

    await user.click(screen.getByRole('button', { name: '关闭本子' }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(store.getState().notebookPhase).toBe('editing')
    expect(screen.getByRole('status')).toHaveTextContent('请先收笔，再关闭本子。')
  })

  it('unmounts the reader before the closing motion starts', async () => {
    const repository = createRepository()
    const user = userEvent.setup()
    const { store } = await renderJournal(repository)

    await user.click(screen.getByRole('button', { name: '关闭本子' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(store.getState().notebookPhase).toBe('closing')
  })
})
