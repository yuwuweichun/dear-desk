import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import type { DailyEntryRepository, LocalDate } from '../../domain/daily-entry'
import { createAppStore } from '../../state/app-store'
import { AppStoreProvider } from '../../state/app-store-context'
import { JournalPanel } from './JournalPanel'

const date = '2026-08-06' as LocalDate

describe('JournalPanel', () => {
  it('saves a DOM draft and reports local persistence', async () => {
    const repository: DailyEntryRepository = {
      getByDate: vi.fn().mockResolvedValue(null),
      save: vi.fn().mockImplementation(async (selectedDate, text) => ({
        date: selectedDate,
        text: text.trim(),
        createdAt: '2026-08-06T01:00:00.000Z',
        updatedAt: '2026-08-06T01:00:00.000Z',
      })),
    }
    const store = createAppStore(repository, date)
    store.getState().openNotebook()
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
      save: vi.fn().mockRejectedValue(new Error('这次没有保存成功')),
    }
    const store = createAppStore(repository, date)
    store.getState().openNotebook()
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
})
