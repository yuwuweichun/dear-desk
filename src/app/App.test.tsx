import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { DailyEntryRepository, LocalDate } from '../domain/daily-entry'
import { createAppStore } from '../state/app-store'
import { AppStoreProvider } from '../state/app-store-context'
import { App } from './App'

vi.mock('../features/journal/JournalPanel', () => ({
  JournalPanel: () => <div data-testid="journal-panel" />,
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
  SceneColorEditorButton: ({ onClick }: { onClick: () => void }) => (
    <button aria-label="打开场景颜色编辑器" onClick={onClick} type="button" />
  ),
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

describe('App notebook animation handoff', () => {
  it('mounts the journal when the notebook reaches editing', () => {
    const store = createAppStore(createRepository(), date)
    store.setState({ notebookPhase: 'editing' })

    render(
      <AppStoreProvider store={store}>
        <App />
      </AppStoreProvider>,
    )

    expect(screen.getByTestId('journal-panel')).toBeInTheDocument()
  })
})

describe('App camera controls', () => {
  it('stacks a pressed-state free camera toggle below the palette control', () => {
    const store = createAppStore(createRepository(), date)

    render(
      <AppStoreProvider store={store}>
        <App />
      </AppStoreProvider>,
    )

    const paletteButton = screen.getByRole('button', {
      name: '打开场景颜色编辑器',
    })
    const freeCameraButton = screen.getByRole('button', {
      name: '开启自由视角',
    })
    const toolStack = paletteButton.closest('.scene-tool-stack')
    expect(toolStack).toContainElement(freeCameraButton)
    expect(freeCameraButton).toHaveAttribute('aria-pressed', 'false')
    expect(freeCameraButton).not.toHaveAttribute('title')
    expect(freeCameraButton.querySelector('.lucide-camera-off')).toBeInTheDocument()

    fireEvent.click(freeCameraButton)

    const enabledFreeCameraButton = screen.getByRole('button', {
      name: '关闭自由视角',
    })
    expect(enabledFreeCameraButton).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(enabledFreeCameraButton).not.toHaveAttribute('title')
    expect(enabledFreeCameraButton.querySelector('.lucide-camera')).toBeInTheDocument()
    expect(enabledFreeCameraButton.querySelector('.lucide-camera-off')).not.toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: '当前远处，切换到正面' }),
    ).toBeDisabled()

    fireEvent.click(enabledFreeCameraButton)
    const disabledFreeCameraButton = screen.getByRole('button', {
      name: '开启自由视角',
    })
    expect(disabledFreeCameraButton).toHaveAttribute(
      'aria-pressed',
      'false',
    )
    expect(disabledFreeCameraButton.querySelector('.lucide-camera-off')).toBeInTheDocument()
  })
})
