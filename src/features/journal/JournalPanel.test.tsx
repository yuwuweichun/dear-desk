import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import type { DailyEntry, DailyEntryRepository, LocalDate } from '../../domain/daily-entry'
import type { ContentFontId } from '../../domain/journal-font'
import type { PlacedSticker } from '../../domain/sticker'
import { createAppStore } from '../../state/app-store'
import { AppStoreProvider } from '../../state/app-store-context'
import { JournalPanel } from './JournalPanel'

const date = '2026-08-06' as LocalDate
const previousDate = '2026-08-05' as LocalDate

const journalSticker: PlacedSticker = {
  definition: {
    id: 'definition-journal',
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
    previewAssetId: 'asset-journal',
    createdAt: '2026-08-07T01:00:00.000Z',
  },
  asset: {
    id: 'asset-journal',
    blob: new Blob(['png'], { type: 'image/png' }),
    height: 80,
    mimeType: 'image/png',
    upstreamCommit: '068caa49eef69745564a5debbc01bab3fcd31042',
    width: 120,
  },
  instance: {
    id: 'instance-journal',
    definitionId: 'definition-journal',
    journalDate: date,
    position: { x: 0.4, y: 0.3 },
    rotationY: 0,
    surface: 'journal',
    createdAt: '2026-08-07T01:00:00.000Z',
    updatedAt: '2026-08-07T01:00:00.000Z',
  },
}

const dailyEntry = (
  entryDate: LocalDate,
  text: string,
  title = entryDate === date ? '今天' : '日记',
): DailyEntry => ({
  date: entryDate,
  title,
  text,
  createdAt: `${entryDate}T01:00:00.000Z`,
  updatedAt: `${entryDate}T01:00:00.000Z`,
})

const createRepository = (
  entries: Partial<Record<LocalDate, DailyEntry>> = {},
): DailyEntryRepository => ({
  getByDate: vi.fn().mockImplementation(async (requestedDate: LocalDate) =>
    entries[requestedDate] ?? null),
  listEntries: vi.fn().mockResolvedValue(Object.values(entries)),
  listDates: vi.fn().mockResolvedValue(Object.keys(entries) as LocalDate[]),
  save: vi.fn().mockImplementation(async (
    selectedDate: LocalDate,
    text: string,
    title?: string,
  ) => dailyEntry(selectedDate, text.trim(), title)),
})

const openNotebook = (store: ReturnType<typeof createAppStore>) => {
  store.getState().requestNotebookOpen()
  store.getState().advanceNotebookPhase('approaching')
  store.getState().advanceNotebookPhase('opening')
}

const renderJournal = async (
  repository: DailyEntryRepository,
  contentFont: ContentFontId = 'paper',
) => {
  const store = createAppStore(repository, date)
  openNotebook(store)
  const result = render(
    <AppStoreProvider store={store}>
      <JournalPanel contentFont={contentFont} />
    </AppStoreProvider>,
  )
  await waitFor(() => {
    expect(store.getState().journalLoadStatus).toBe('ready')
  })
  return { store, ...result }
}

const startWriting = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(screen.getByRole('button', { name: '编辑' }))
  return screen.getByRole('textbox', { name: '本页记录' })
}

describe('JournalPanel', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('opens with a sticker left page and keeps the mode across turns', async () => {
    const repository = createRepository({
      [previousDate]: dailyEntry(previousDate, '上一页留下的内容'),
    })
    const user = userEvent.setup()
    const { container, store } = await renderJournal(repository)

    const readingMode = screen.getByRole('button', { name: '阅读' })
    const editingMode = screen.getByRole('button', { name: '编辑' })
    expect(readingMode).toHaveAttribute('aria-pressed', 'true')
    expect(editingMode).toHaveAttribute('aria-pressed', 'false')
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    expect(container.querySelector('.journal-page-left')).toHaveTextContent('前往贴纸工作台')
    expect(screen.getByRole('button', { name: '前往贴纸工作台' })).toBeVisible()
    expect(screen.queryByText('尚未留下')).not.toBeInTheDocument()
    expect(screen.queryByText('当前日期')).not.toBeInTheDocument()
    expect(screen.queryByText('旧日记录')).not.toBeInTheDocument()
    expect(container.querySelector('.journal-bookmark')).not.toBeInTheDocument()
    const navigation = container.querySelector('.journal-page-navigation-controls')
    expect(navigation).not.toHaveTextContent('8月')
    expect(navigation?.querySelector('.journal-turn-button.is-previous svg')).toHaveClass('lucide-undo-2')
    expect(navigation?.querySelector('.journal-turn-button.is-next svg')).toHaveClass('lucide-redo-2')

    await user.click(screen.getByRole('button', { name: /上一页/ }))
    await waitFor(() => {
      expect(container.querySelector('.page-turn-overlay.is-previous')).toBeInTheDocument()
    })
    const previousTurnSheet = container.querySelector('.page-turn-overlay.is-previous')
    expect(previousTurnSheet).toHaveAttribute('data-page-turn-engine', 'page-flip')
    expect(previousTurnSheet).toHaveTextContent('上一页留下的内容')
    act(() => store.getState().settleJournalTurn())

    const rightPage = container.querySelector('.journal-page-right')
    expect(rightPage).not.toBeNull()
    expect(within(rightPage as HTMLElement).getByText('上一页留下的内容')).toBeVisible()
    expect(screen.getByRole('button', { name: '阅读' })).toHaveAttribute('aria-pressed', 'true')

    await user.click(editingMode)
    expect(screen.getByRole('textbox', { name: '本页记录' })).toBeVisible()
    await user.click(readingMode)
    await user.click(screen.getByRole('button', { name: /下一页/ }))
    await waitFor(() => {
      expect(container.querySelector('.page-turn-overlay.is-next')).toBeInTheDocument()
    })
    const nextTurnSheet = container.querySelector('.page-turn-overlay.is-next')
    expect(nextTurnSheet).toHaveAttribute('data-page-turn-engine', 'page-flip')
    act(() => store.getState().settleJournalTurn())

    expect(screen.getByRole('heading', { name: '今天' })).toBeVisible()
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
  })

  it('shows current-date stickers on the left page and opens the sticker workbench', async () => {
    const user = userEvent.setup()
    const { container, store } = await renderJournal(createRepository())
    act(() => store.setState({ journalPageStickers: { [date]: [journalSticker] } }))

    expect(await screen.findByRole('button', { name: '选择贴纸 今天很好' })).toBeVisible()
    expect(container.querySelector('.journal-page-left')).toHaveTextContent('1 张')

    await user.click(screen.getByRole('button', { name: '前往贴纸工作台' }))
    expect(store.getState()).toMatchObject({
      notebookPhase: 'desk',
      stickerWorkflow: 'composing',
    })
  })

  it('writes and saves today through the editing and writing controls', async () => {
    const repository = createRepository()
    const user = userEvent.setup()
    await renderJournal(repository)

    const textarea = await startWriting(user)
    const title = screen.getByRole('textbox', { name: '日记标题' })
    expect(title).toHaveValue('今天')
    expect(title).toHaveAttribute('autocomplete', 'off')
    expect(title).toHaveAttribute('autocapitalize', 'none')
    expect(title).toHaveAttribute('spellcheck', 'false')
    await user.clear(title)
    await user.type(title, '第一天')
    await user.type(textarea, '今天把第一句话留在桌上。')
    await user.click(screen.getByRole('button', { name: '保存本页' }))

    await waitFor(() => {
      expect(repository.save).toHaveBeenCalledWith(date, '今天把第一句话留在桌上。', '第一天')
    })
    expect(await screen.findByText('今天把第一句话留在桌上。')).toBeVisible()
    expect(screen.getByRole('heading', { name: '第一天' })).toBeVisible()
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('已收笔，内容已存入本地。')

    const writeAgainButton = screen.getByRole('button', { name: '开始书写本页' })
    expect(writeAgainButton).toHaveAttribute('type', 'button')
    await user.click(writeAgainButton)
    expect(screen.getByRole('button', { name: '保存本页' })).toHaveAttribute('type', 'button')
    expect(screen.getByRole('textbox', { name: '日记标题' })).toHaveValue('第一天')
    expect(screen.getByRole('textbox', { name: '本页记录' })).toHaveValue(
      '今天把第一句话留在桌上。',
    )
  })

  it('uses the global content font without rendering a journal-owned font control', async () => {
    const repository = createRepository({
      [date]: dailyEntry(date, '字体会同时影响阅读与书写。'),
    })
    await renderJournal(repository, 'zhimang')
    expect(screen.getByRole('dialog')).toHaveAttribute('data-journal-font', 'zhimang')
    expect(screen.queryByRole('button', { name: /更换字体/ })).not.toBeInTheDocument()
  })

  it('edits and saves a historical page without replacing todays entry alias', async () => {
    const repository = createRepository({
      [previousDate]: dailyEntry(previousDate, '旧句子'),
    })
    const user = userEvent.setup()
    const { container, store } = await renderJournal(repository)

    await user.click(screen.getByRole('button', { name: /上一页/ }))
    await waitFor(() => {
      expect(container.querySelector('.page-turn-overlay.is-previous')).toBeInTheDocument()
    })
    act(() => store.getState().settleJournalTurn())

    const textarea = await startWriting(user)
    expect(textarea).toHaveValue('旧句子')
    await user.clear(textarea)
    await user.type(textarea, '改过的旧句子')
    await user.click(screen.getByRole('button', { name: '保存本页' }))

    await waitFor(() => {
      expect(repository.save).toHaveBeenCalledWith(previousDate, '改过的旧句子', '日记')
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

    await user.click(screen.getByRole('button', { name: '阅读' }))
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
