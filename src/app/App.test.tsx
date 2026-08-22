import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { DailyEntryRepository, LocalDate } from '../domain/daily-entry'
import { CONTENT_FONT_STORAGE_KEY } from '../domain/journal-font'
import type { NotebookCoverSettingsRepository } from '../domain/notebook-cover-settings'
import { createAppStore } from '../state/app-store'
import { AppStoreProvider } from '../state/app-store-context'
import { App } from './App'

vi.mock('../features/journal/JournalPanel', () => ({
  JournalPanel: ({ contentFont }: { contentFont: string }) => (
    <div data-content-font={contentFont} data-testid="journal-panel" />
  ),
}))
vi.mock('../features/stickers/StickerControls', () => ({
  StickerControls: () => null,
}))
vi.mock('../features/stickers/StickerStudio', () => ({
  StickerStudio: () => null,
}))
vi.mock('../scene/DeskScene', () => ({
  DeskScene: ({ contentFont }: { contentFont: string }) => (
    <div data-content-font={contentFont} data-testid="desk-scene" />
  ),
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

const createNameplateRepository = (): NotebookCoverSettingsRepository => ({
  get: vi.fn().mockResolvedValue(null),
  save: vi.fn().mockImplementation(async (label) => ({
    id: 'primary', label, updatedAt: '2026-08-19T06:30:00.000Z',
  })),
})

afterEach(() => {
  vi.useRealTimers()
  window.localStorage.clear()
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

describe('App nameplate editor', () => {
  it('opens beside the notebook action and saves a valid label', async () => {
    const nameplateRepository = createNameplateRepository()
    const store = createAppStore(createRepository(), date, undefined, nameplateRepository)
    render(
      <AppStoreProvider store={store}>
        <App />
      </AppStoreProvider>,
    )

    await vi.waitFor(() => expect(screen.getByRole('button', { name: '编辑铭牌' })).toBeEnabled())
    fireEvent.click(screen.getByRole('button', { name: '编辑铭牌' }))
    const input = screen.getByLabelText('铭牌文字')
    expect(input).toHaveAttribute('maxlength', '12')
    fireEvent.change(input, { target: { value: 'DEAR DESK' } })
    fireEvent.click(screen.getByRole('button', { name: '保存铭牌' }))

    await vi.waitFor(() => expect(nameplateRepository.save).toHaveBeenCalledWith('DEAR DESK'))
    await vi.waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('preserves lowercase text in the input and saved label', async () => {
    const nameplateRepository = createNameplateRepository()
    const store = createAppStore(createRepository(), date, undefined, nameplateRepository)
    render(
      <AppStoreProvider store={store}>
        <App />
      </AppStoreProvider>,
    )

    await vi.waitFor(() => expect(screen.getByRole('button', { name: '编辑铭牌' })).toBeEnabled())
    fireEvent.click(screen.getByRole('button', { name: '编辑铭牌' }))
    const input = screen.getByLabelText('铭牌文字')
    expect(input).toHaveAttribute('autocomplete', 'off')
    expect(input).toHaveAttribute('autocapitalize', 'none')
    expect(input).toHaveAttribute('autocorrect', 'off')
    expect(input).toHaveAttribute('name', 'notebook-nameplate')
    expect(input).toHaveAttribute('spellcheck', 'false')
    fireEvent.change(input, { target: { value: 'dear desk' } })

    expect(input).toHaveValue('dear desk')

    fireEvent.click(screen.getByRole('button', { name: '保存铭牌' }))
    await vi.waitFor(() => expect(nameplateRepository.save).toHaveBeenCalledWith('dear desk'))
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

describe('App global content font', () => {
  it('places the control in the upper-right stack and synchronizes scene and journal', async () => {
    const store = createAppStore(createRepository(), date)
    const { container } = render(
      <AppStoreProvider store={store}>
        <App />
      </AppStoreProvider>,
    )

    const paletteButton = screen.getByRole('button', { name: '打开场景颜色编辑器' })
    const fontButton = screen.getByRole('button', {
      name: '更换内容字体，当前纸页宋体',
    })
    const cameraButton = screen.getByRole('button', { name: '开启自由视角' })
    const toolStack = paletteButton.closest('.scene-tool-stack')
    expect(toolStack).toContainElement(fontButton)
    expect(toolStack).toContainElement(cameraButton)
    expect(Array.from(toolStack?.children ?? [])).toEqual([
      paletteButton,
      fontButton.closest('.content-font-control'),
      cameraButton,
    ])

    fireEvent.click(fontButton)
    const menu = screen.getByRole('menu', { name: '选择内容字体' })
    fireEvent.click(within(menu).getByRole('menuitemradio', { name: /志莽行书/ }))

    expect(window.localStorage.getItem(CONTENT_FONT_STORAGE_KEY)).toBe('zhimang')
    expect(screen.getByTestId('desk-scene')).toHaveAttribute('data-content-font', 'zhimang')
    expect(container.querySelector('.app-shell')).not.toHaveAttribute('data-journal-font')

    act(() => store.setState({ notebookPhase: 'editing' }))
    expect(screen.getByTestId('journal-panel')).toHaveAttribute('data-content-font', 'zhimang')
  })

  it('restores the existing preference from the legacy storage key', () => {
    window.localStorage.setItem(CONTENT_FONT_STORAGE_KEY, 'suifeng')
    const store = createAppStore(createRepository(), date)

    render(
      <AppStoreProvider store={store}>
        <App />
      </AppStoreProvider>,
    )

    expect(screen.getByRole('button', {
      name: '更换内容字体，当前随峰体',
    })).toBeInTheDocument()
    expect(screen.getByTestId('desk-scene')).toHaveAttribute('data-content-font', 'suifeng')
  })
})
