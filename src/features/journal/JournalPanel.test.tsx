import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import type { DailyEntryRepository, LocalDate } from '../../domain/daily-entry'
import { createAppStore } from '../../state/app-store'
import { AppStoreProvider } from '../../state/app-store-context'
import { JournalPanel } from './JournalPanel'

const date = '2026-08-06' as LocalDate

const openNotebook = (store: ReturnType<typeof createAppStore>) => {
  store.getState().requestNotebookOpen()
  store.getState().advanceNotebookPhase('approaching')
  store.getState().advanceNotebookPhase('opening')
}

describe('JournalPanel', () => {
  it('turns backward from the left page and forward from the right page', async () => {
    const previousDate = '2026-08-05' as LocalDate
    const repository: DailyEntryRepository = {
      getByDate: vi.fn().mockImplementation(async (requestedDate) =>
        requestedDate === previousDate
          ? {
              date: previousDate,
              text: '上一页留下的内容',
              createdAt: '2026-08-05T01:00:00.000Z',
              updatedAt: '2026-08-05T01:00:00.000Z',
            }
          : null,
      ),
      listDates: vi.fn().mockResolvedValue([previousDate]),
      save: vi.fn(),
    }
    const store = createAppStore(repository, date)
    openNotebook(store)
    const user = userEvent.setup()
    const { container } = render(
      <AppStoreProvider store={store}>
        <JournalPanel />
      </AppStoreProvider>,
    )

    const previousPage = await screen.findByRole('button', { name: /上一页/ })
    await user.click(previousPage)
    await waitFor(() => {
      expect(container.querySelector('.page-turn-sheet.is-previous')).toBeInTheDocument()
    })
    act(() => store.getState().settleJournalTurn())

    expect(await screen.findByText('上一页留下的内容')).toBeInTheDocument()
    const nextPage = await screen.findByRole('button', { name: /下一页/ })
    await user.click(nextPage)
    await waitFor(() => {
      expect(container.querySelector('.page-turn-sheet.is-next')).toBeInTheDocument()
    })
    act(() => store.getState().settleJournalTurn())

    expect(screen.getByRole('textbox', { name: '今天的记录' })).toBeVisible()
  })

  it('saves a DOM draft and reports local persistence', async () => {
    const repository: DailyEntryRepository = {
      getByDate: vi.fn().mockResolvedValue(null),
      listDates: vi.fn().mockResolvedValue([]),
      save: vi.fn().mockImplementation(async (selectedDate, text) => ({
        date: selectedDate,
        text: text.trim(),
        createdAt: '2026-08-06T01:00:00.000Z',
        updatedAt: '2026-08-06T01:00:00.000Z',
      })),
    }
    const store = createAppStore(repository, date)
    openNotebook(store)
    const user = userEvent.setup()

    render(
      <AppStoreProvider store={store}>
        <JournalPanel />
      </AppStoreProvider>,
    )

    const textarea = screen.getByRole('textbox', { name: '今天的记录' })
    await user.type(textarea, '今天把第一句话留在桌上。')
    await user.click(screen.getByRole('button', { name: '保存' }))

    expect(repository.save).toHaveBeenCalledWith(date, '今天把第一句话留在桌上。')
    expect(await screen.findByText('已存入本地')).toBeVisible()
  })

  it('keeps the draft visible when persistence fails', async () => {
    const repository: DailyEntryRepository = {
      getByDate: vi.fn().mockResolvedValue(null),
      listDates: vi.fn().mockResolvedValue([]),
      save: vi.fn().mockRejectedValue(new Error('这次没有保存成功')),
    }
    const store = createAppStore(repository, date)
    openNotebook(store)
    const user = userEvent.setup()

    render(
      <AppStoreProvider store={store}>
        <JournalPanel />
      </AppStoreProvider>,
    )

    const textarea = screen.getByRole('textbox', { name: '今天的记录' })
    await user.type(textarea, '不要丢掉这句话')
    await user.click(screen.getByRole('button', { name: '保存' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('这次没有保存成功')
    expect(textarea).toHaveValue('不要丢掉这句话')
  })

  it('unmounts the editor before the closing motion starts', async () => {
    const repository: DailyEntryRepository = {
      getByDate: vi.fn().mockResolvedValue(null),
      listDates: vi.fn().mockResolvedValue([]),
      save: vi.fn(),
    }
    const store = createAppStore(repository, date)
    openNotebook(store)
    const user = userEvent.setup()

    render(
      <AppStoreProvider store={store}>
        <JournalPanel />
      </AppStoreProvider>,
    )

    await user.click(screen.getByRole('button', { name: '关闭本子' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(store.getState().notebookPhase).toBe('closing')
  })
})
