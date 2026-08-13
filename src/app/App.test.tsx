import { act, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { DailyEntryRepository, LocalDate } from '../domain/daily-entry'
import { createAppStore } from '../state/app-store'
import { AppStoreProvider } from '../state/app-store-context'
import { App } from './App'

vi.mock('../features/journal/JournalPanel', () => ({
  JournalPanel: () => null,
}))
vi.mock('../features/stickers/StickerControls', () => ({
  StickerControls: () => null,
}))
vi.mock('../features/stickers/StickerStudio', () => ({
  StickerStudio: () => null,
}))
vi.mock('../scene/DeskScene', () => ({
  DeskScene: () => <div data-testid="desk-scene" />,
}))
vi.mock('../scene/SceneColorEditor', () => ({
  SceneColorEditor: () => null,
  SceneColorEditorButton: () => null,
}))

const date = '2026-08-13' as LocalDate

const createRepository = (): DailyEntryRepository => ({
  getByDate: vi.fn().mockResolvedValue(null),
  listDates: vi.fn().mockResolvedValue([]),
  save: vi.fn(),
})

afterEach(() => {
  vi.useRealTimers()
})

describe('App time HUD', () => {
  it('uses the Animal Island HUD clock without the old entry status content', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 7, 13, 17, 53))
    const store = createAppStore(createRepository(), date)

    render(
      <AppStoreProvider store={store}>
        <App />
      </AppStoreProvider>,
    )

    expect(screen.getByText('Thursday')).toBeInTheDocument()
    expect(screen.getByText('Aug 13')).toBeInTheDocument()
    expect(screen.getByText((_, element) => element?.textContent === '17:53')).toBeInTheDocument()
    expect(screen.queryByText('今天还是空白')).not.toBeInTheDocument()
    expect(screen.queryByText('今天有一页')).not.toBeInTheDocument()

    act(() => store.setState({ notebookPhase: 'approaching' }))

    expect(screen.queryByText('Thursday')).not.toBeInTheDocument()
    expect(screen.queryByText('Aug 13')).not.toBeInTheDocument()
  })
})
