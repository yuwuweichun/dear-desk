import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { DailyEntryRepository, LocalDate } from '../domain/daily-entry'
import { AUDIO_PREFERENCES_STORAGE_KEY } from '../audio/audio-preferences'
import { CONTENT_FONT_STORAGE_KEY } from '../domain/journal-font'
import type { NotebookCoverSettingsRepository } from '../domain/notebook-cover-settings'
import type {
  SceneColorConfig,
  SceneColorPreset,
  SceneColorPresetRepository,
} from '../domain/scene-color-preset'
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
  DeskScene: ({
    colors,
    contentFont,
    onCaptureReady,
    showRoomBackground,
  }: {
    colors: SceneColorConfig
    contentFont: string
    showRoomBackground: boolean
    onCaptureReady?: (capture: () => Promise<{
      blob: Blob
      mimeType: 'image/webp'
    }>) => void
  }) => (
    <div
      data-content-font={contentFont}
      data-scene-colors={JSON.stringify(colors)}
      data-show-room-background={showRoomBackground}
      data-testid="desk-scene"
    >
      <button
        onClick={() => onCaptureReady?.(async () => ({
          blob: new Blob(['scene'], { type: 'image/webp' }),
          mimeType: 'image/webp',
        }))}
        type="button"
      >
        准备场景截图
      </button>
    </div>
  ),
}))
vi.mock('../scene/SceneColorEditor', () => ({
  SceneColorEditor: ({
    onChange,
    onClose,
    onDeletePreset,
    onSavePreset,
    presets = [],
  }: {
    onChange: (colors: SceneColorConfig) => void
    onClose: () => void
    onDeletePreset?: (id: string) => Promise<void>
    onSavePreset?: (name: string) => Promise<unknown>
    presets?: SceneColorPreset[]
  }) => (
    <aside aria-label="场景颜色编辑器" role="dialog">
      <button aria-label="关闭颜色面板" onClick={onClose} type="button" />
      <button onClick={() => void onSavePreset?.('测试预设')} type="button">
        保存测试预设
      </button>
      {presets.map((preset) => (
        <div key={preset.id}>
          <button onClick={() => onChange(preset.colors)} type="button">
            应用 {preset.name}
          </button>
          <button onClick={() => void onDeletePreset?.(preset.id)} type="button">
            删除 {preset.name}
          </button>
        </div>
      ))}
    </aside>
  ),
  SceneColorEditorButton: ({
    expanded,
    onClick,
  }: {
    expanded: boolean
    onClick: () => void
  }) => (
    <button
      aria-expanded={expanded}
      aria-label="打开场景颜色编辑器"
      onClick={onClick}
      type="button"
    />
  ),
}))

const date = '2026-08-13' as LocalDate

const createRepository = (): DailyEntryRepository => ({
  getByDate: vi.fn().mockResolvedValue(null),
  listEntries: vi.fn().mockResolvedValue([]),
  listDates: vi.fn().mockResolvedValue([]),
  save: vi.fn(),
})

const createNameplateRepository = (): NotebookCoverSettingsRepository => ({
  get: vi.fn().mockResolvedValue(null),
  save: vi.fn().mockImplementation(async (label) => ({
    id: 'primary', label, updatedAt: '2026-08-19T06:30:00.000Z',
  })),
})

const createSceneColorPresetRepository = (
  presets: SceneColorPreset[] = [],
): SceneColorPresetRepository => ({
  list: vi.fn().mockResolvedValue(presets),
  create: vi.fn().mockImplementation(async (name, colors, preview) => ({
    id: 'created-preset',
    name,
    colors,
    previewBlob: preview?.blob,
    previewMimeType: preview?.mimeType,
    createdAt: '2026-08-25T09:50:00.000Z',
    updatedAt: '2026-08-25T09:50:00.000Z',
  })),
  delete: vi.fn().mockResolvedValue(undefined),
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

describe('App old traces entry', () => {
  it('opens the center-drawer workflow from the equivalent desk command', async () => {
    const store = createAppStore(createRepository(), date)
    render(
      <AppStoreProvider store={store}>
        <App />
      </AppStoreProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: '旧痕迹' }))
    expect(store.getState().pastTracesPhase).toBe('opening')
    await vi.waitFor(() => expect(store.getState().pastTracesStatus).toBe('ready'))

    act(() => store.getState().settlePastTracesTransition())
    expect(screen.getByRole('dialog', { name: '旧痕迹' })).toBeInTheDocument()
    expect(screen.getByText('还没有可以翻找的旧痕迹。')).toBeInTheDocument()
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
      name: '关闭自由视角',
    })
    const toolStack = paletteButton.closest('.scene-tool-stack')
    expect(toolStack).toContainElement(freeCameraButton)
    expect(freeCameraButton).toHaveAttribute('aria-pressed', 'true')
    expect(freeCameraButton).not.toHaveAttribute('title')
    expect(freeCameraButton.querySelector('.lucide-camera')).toBeInTheDocument()
    expect(freeCameraButton.querySelector('.lucide-camera-off')).not.toBeInTheDocument()

    fireEvent.click(freeCameraButton)

    const disabledFreeCameraButton = screen.getByRole('button', {
      name: '开启自由视角',
    })
    expect(disabledFreeCameraButton).toHaveAttribute('aria-pressed', 'false')
    expect(disabledFreeCameraButton).not.toHaveAttribute('title')
    expect(disabledFreeCameraButton).toBeDisabled()
    expect(disabledFreeCameraButton.querySelector('.lucide-camera-off')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: '当前远处，切换到正面' }),
    ).toBeDisabled()
  })
})

describe('App room background control', () => {
  it('toggles the room background visibility state from the scene tool stack', () => {
    const store = createAppStore(createRepository(), date)

    render(
      <AppStoreProvider store={store}>
        <App />
      </AppStoreProvider>,
    )

    const backgroundButton = screen.getByRole('button', { name: '隐藏房间背景' })
    expect(backgroundButton).toHaveAttribute('aria-pressed', 'true')
    expect(backgroundButton.querySelector('.lucide-eye')).toBeInTheDocument()

    fireEvent.click(backgroundButton)

    const hiddenBackgroundButton = screen.getByRole('button', { name: '显示房间背景' })
    expect(hiddenBackgroundButton).toHaveAttribute('aria-pressed', 'false')
    expect(hiddenBackgroundButton.querySelector('.lucide-eye-off')).toBeInTheDocument()
    expect(screen.getByTestId('desk-scene')).toHaveAttribute(
      'data-show-room-background',
      'false',
    )

    fireEvent.click(hiddenBackgroundButton)
    expect(screen.getByRole('button', { name: '隐藏房间背景' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  })
})

describe('App scene color editor', () => {
  it('keeps the controls visible while allowing only one settings panel', () => {
    const store = createAppStore(createRepository(), date)

    render(
      <AppStoreProvider store={store}>
        <App />
      </AppStoreProvider>,
    )

    const paletteButton = screen.getByRole('button', {
      name: '打开场景颜色编辑器',
    })
    const fontButton = screen.getByRole('button', {
      name: '更换内容字体，当前纸页宋体',
    })
    const audioButton = screen.getByRole('button', { name: '音频设置' })
    const toolStack = paletteButton.closest('.scene-tool-stack')
    fireEvent.click(paletteButton)

    expect(paletteButton).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('dialog', { name: '场景颜色编辑器' }))
      .toBeInTheDocument()
    expect(toolStack).toContainElement(fontButton)
    expect(toolStack).toContainElement(screen.getByRole('button', {
      name: '开启自由视角',
    }))
    expect(audioButton).toBeInTheDocument()

    fireEvent.click(fontButton)
    expect(paletteButton).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('dialog', { name: '场景颜色编辑器' }))
      .not.toBeInTheDocument()
    expect(screen.getByRole('menu', { name: '选择内容字体' })).toBeInTheDocument()
    expect(fontButton).toHaveAttribute('aria-expanded', 'true')

    fireEvent.click(audioButton)
    expect(screen.queryByRole('menu', { name: '选择内容字体' }))
      .not.toBeInTheDocument()
    expect(fontButton).toHaveAttribute('aria-expanded', 'false')
    expect(screen.getByRole('dialog', { name: '音频设置' })).toBeInTheDocument()
    expect(audioButton).toHaveAttribute('aria-expanded', 'true')

    fireEvent.click(paletteButton)
    expect(screen.queryByRole('dialog', { name: '音频设置' }))
      .not.toBeInTheDocument()
    expect(audioButton).toHaveAttribute('aria-expanded', 'false')
    expect(screen.getByRole('dialog', { name: '场景颜色编辑器' }))
      .toBeInTheDocument()
    expect(paletteButton).toHaveAttribute('aria-expanded', 'true')

    fireEvent.click(paletteButton)
    expect(paletteButton).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('dialog', { name: '场景颜色编辑器' }))
      .not.toBeInTheDocument()
  })

  it('loads, captures, saves, applies, and deletes scene color presets', async () => {
    const colors: SceneColorConfig = {
      background: '#223344',
      deskFrame: '#334455',
      deskInset: '#445566',
      deskLegs: '#556677',
      deskTop: '#667788',
      matBinding: '#778899',
      matField: '#8899aa',
      notebookCover: '#1a2b3c',
      notebookJoint: '#0a1b2c',
    }
    const existing: SceneColorPreset = {
      id: 'existing',
      name: '雨天',
      colors,
      createdAt: '2026-08-25T09:40:00.000Z',
      updatedAt: '2026-08-25T09:40:00.000Z',
    }
    const presetRepository = createSceneColorPresetRepository([existing])
    const store = createAppStore(createRepository(), date)

    render(
      <AppStoreProvider store={store}>
        <App sceneColorPresetRepository={presetRepository} />
      </AppStoreProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: '准备场景截图' }))
    fireEvent.click(screen.getByRole('button', { name: '打开场景颜色编辑器' }))
    expect(await screen.findByRole('button', { name: '应用 雨天' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '应用 雨天' }))
    expect(screen.getByTestId('desk-scene')).toHaveAttribute(
      'data-scene-colors',
      JSON.stringify(colors),
    )

    fireEvent.click(screen.getByRole('button', { name: '保存测试预设' }))
    await waitFor(() => expect(presetRepository.create).toHaveBeenCalledWith(
      '测试预设',
      colors,
      expect.objectContaining({ mimeType: 'image/webp' }),
    ))
    expect(await screen.findByRole('button', { name: '应用 测试预设' }))
      .toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '删除 雨天' }))
    await waitFor(() => expect(presetRepository.delete).toHaveBeenCalledWith('existing'))
    expect(screen.queryByRole('button', { name: '应用 雨天' })).not.toBeInTheDocument()
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
    const cameraButton = screen.getByRole('button', { name: '关闭自由视角' })
    const toolStack = paletteButton.closest('.scene-tool-stack')
    expect(toolStack).toContainElement(fontButton)
    expect(toolStack).toContainElement(cameraButton)
    expect(Array.from(toolStack?.children ?? [])).toEqual([
      paletteButton.closest('.scene-color-control'),
      fontButton.closest('.content-font-control'),
      screen.getByRole('button', { name: '隐藏房间背景' }),
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

describe('App audio settings', () => {
  it('keeps the upper-right control available while the notebook is open and persists preferences', () => {
    const store = createAppStore(createRepository(), date)
    render(
      <AppStoreProvider store={store}>
        <App />
      </AppStoreProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: '音频设置' }))
    fireEvent.click(screen.getByRole('switch', { name: '音乐开关' }))
    fireEvent.change(screen.getByRole('slider', { name: '音乐音量' }), {
      target: { value: '40' },
    })
    fireEvent.change(screen.getByRole('slider', { name: '音效音量' }), {
      target: { value: '55' },
    })

    expect(JSON.parse(window.localStorage.getItem(AUDIO_PREFERENCES_STORAGE_KEY) ?? '')).toEqual({
      version: 1,
      music: { enabled: true, volume: 0.4 },
      sfx: { enabled: true, volume: 0.55 },
    })

    act(() => store.setState({ notebookPhase: 'editing' }))
    expect(screen.getByRole('button', { name: '音频设置' })).toBeInTheDocument()
  })
})
