import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import type { DailyEntryRepository, LocalDate } from '../../domain/daily-entry'
import { createAppStore } from '../../state/app-store'
import { AppStoreProvider } from '../../state/app-store-context'
import { PastTracesPanel } from './PastTracesPanel'

const today = '2026-08-24' as LocalDate
const repository: DailyEntryRepository = {
  getByDate: vi.fn().mockResolvedValue(null),
  listEntries: vi.fn().mockResolvedValue([]),
  listDates: vi.fn().mockResolvedValue([]),
  save: vi.fn(),
}

describe('PastTracesPanel', () => {
  it('groups summaries by month and sends the chosen date back to the drawer state', () => {
    const store = createAppStore(repository, today)
    store.setState({
      pastTraces: [
        {
          date: '2026-08-02',
          hasEntry: true,
          stickerCount: 2,
          textPreview: '在窗边写了一会儿。',
          title: '夏日',
        },
        {
          date: '2026-07-12',
          hasEntry: false,
          stickerCount: 1,
          textPreview: '',
          title: '日记',
        },
      ],
      pastTracesPhase: 'open',
      pastTracesStatus: 'ready',
    })

    render(
      <AppStoreProvider store={store}>
        <PastTracesPanel />
      </AppStoreProvider>,
    )

    expect(screen.getByRole('dialog', { name: '旧痕迹' })).toBeInTheDocument()
    expect(screen.getByText('2026年8月')).toBeInTheDocument()
    expect(screen.getByText('2026年7月')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '关闭旧痕迹' })).toHaveFocus()
    expect(screen.getByText('仅有贴纸')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', {
      name: '打开 2026-08-02 的旧痕迹',
    }))
    expect(store.getState()).toMatchObject({
      pastTracesPhase: 'closing',
      pendingJournalDate: '2026-08-02',
    })
  })

  it('closes on Escape without choosing a date', () => {
    const store = createAppStore(repository, today)
    store.setState({ pastTracesPhase: 'open', pastTracesStatus: 'ready' })
    render(
      <AppStoreProvider store={store}>
        <PastTracesPanel />
      </AppStoreProvider>,
    )

    fireEvent.keyDown(window, { key: 'Escape' })
    expect(store.getState()).toMatchObject({
      pastTracesPhase: 'closing',
      pendingJournalDate: null,
    })
  })
})
