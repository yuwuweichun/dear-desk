import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { getSceneColorConfig } from './models/material-library'
import { isSceneHexColor, serializeSceneColors } from './scene-color'
import { SceneColorEditor, SceneColorEditorButton } from './SceneColorEditor'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('SceneColorEditor', () => {
  it('keeps the palette button accessible without a native hover title', () => {
    render(<SceneColorEditorButton expanded onClick={vi.fn()} />)

    const button = screen.getByRole('button', { name: '打开场景颜色编辑器' })
    expect(button).not.toHaveAttribute('title')
    expect(button).toHaveAttribute('aria-controls', 'scene-color-editor')
    expect(button).toHaveAttribute('aria-expanded', 'true')
    expect(button).toHaveAttribute('aria-haspopup', 'dialog')
  })

  it('recognizes only complete six-digit HEX colors', () => {
    expect(isSceneHexColor('#12aBcF')).toBe(true)
    expect(isSceneHexColor('#123')).toBe(false)
    expect(isSceneHexColor('123456')).toBe(false)
    expect(isSceneHexColor('#xyzxyz')).toBe(false)
  })

  it('renders all nine surface controls and only commits valid text colors', async () => {
    const colors = getSceneColorConfig()
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(
      <SceneColorEditor
        colors={colors}
        onChange={onChange}
        onClose={vi.fn()}
        onReset={vi.fn()}
      />,
    )

    expect(screen.getByRole('dialog', { name: '场景颜色编辑器' }))
      .toHaveAttribute('id', 'scene-color-editor')
    expect(screen.getAllByRole('textbox')).toHaveLength(9)
    const deskLegs = screen.getByRole('textbox', { name: '桌腿与支撑 HEX' })
    await user.clear(deskLegs)
    await user.type(deskLegs, '#FF00AA')

    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenLastCalledWith({ ...colors, deskLegs: '#ff00aa' })
  })

  it('keeps the native color input mounted across continuous changes', () => {
    const colors = getSceneColorConfig()
    const { rerender } = render(
      <SceneColorEditor
        colors={colors}
        onChange={vi.fn()}
        onClose={vi.fn()}
        onReset={vi.fn()}
      />,
    )
    const swatch = screen.getByLabelText('桌面颜色')

    fireEvent.change(swatch, { target: { value: '#123456' } })
    rerender(
      <SceneColorEditor
        colors={{ ...colors, deskTop: '#123456' }}
        onChange={vi.fn()}
        onClose={vi.fn()}
        onReset={vi.fn()}
      />,
    )

    expect(screen.getByLabelText('桌面颜色')).toBe(swatch)
    expect(screen.getByRole('textbox', { name: '桌面 HEX' })).toHaveValue('#123456')
  })

  it('serializes and copies the complete transient configuration', async () => {
    const colors = getSceneColorConfig()
    const writeText = vi.fn().mockResolvedValue(undefined)
    const user = userEvent.setup()
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    })
    render(
      <SceneColorEditor
        colors={colors}
        onChange={vi.fn()}
        onClose={vi.fn()}
        onReset={vi.fn()}
      />,
    )

    await user.click(screen.getByRole('button', { name: '复制颜色配置' }))
    expect(writeText).toHaveBeenCalledWith(serializeSceneColors(colors))
    expect(screen.getByText('颜色配置已复制')).toBeInTheDocument()
  })

  it('names, applies, and deletes preview cards without mixing the commands', async () => {
    const colors = getSceneColorConfig()
    const rainColors = { ...colors, background: '#334455', matField: '#556677' }
    const previewBlob = new Blob(['scene'], { type: 'image/webp' })
    const onChange = vi.fn()
    const onDeletePreset = vi.fn().mockResolvedValue(undefined)
    const onSavePreset = vi.fn().mockResolvedValue({
      preset: {
        id: 'saved',
        name: '夜灯',
        colors,
        createdAt: '2026-08-25T09:40:00.000Z',
        updatedAt: '2026-08-25T09:40:00.000Z',
      },
      previewCaptured: true,
    })
    const createObjectURL = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:rain')
    const revokeObjectURL = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined)
    const user = userEvent.setup()
    const { container, unmount } = render(
      <SceneColorEditor
        colors={colors}
        onChange={onChange}
        onClose={vi.fn()}
        onDeletePreset={onDeletePreset}
        onReset={vi.fn()}
        onSavePreset={onSavePreset}
        presets={[
          {
            id: 'rain',
            name: '雨天',
            colors: rainColors,
            previewBlob,
            previewMimeType: 'image/webp',
            createdAt: '2026-08-25T09:30:00.000Z',
            updatedAt: '2026-08-25T09:30:00.000Z',
          },
          {
            id: 'no-preview',
            name: '无图片',
            colors: { ...colors, deskTop: '#778899' },
            createdAt: '2026-08-25T09:20:00.000Z',
            updatedAt: '2026-08-25T09:20:00.000Z',
          },
        ]}
      />,
    )

    await user.click(screen.getByRole('tab', { name: '预设' }))
    expect(screen.getByRole('tabpanel', { name: '预设' })).toBeInTheDocument()
    expect(screen.getByAltText('默认配色场景预览')).toHaveAttribute(
      'src',
      '/assets/scene-color-presets/default-v11.webp',
    )
    expect(screen.getByAltText('雨天场景预览')).toHaveAttribute('src', 'blob:rain')
    expect(createObjectURL).toHaveBeenCalledWith(previewBlob)
    expect(container.querySelector('.scene-preset-card__colors')).not.toBeInTheDocument()
    expect(container.querySelector('.scene-preset-card__fallback svg')).toBeInTheDocument()

    await user.type(screen.getByLabelText('预设名称'), '夜灯')
    await user.click(screen.getByRole('button', { name: /保存/ }))
    expect(onSavePreset).toHaveBeenCalledWith('夜灯')
    expect(await screen.findByText('已保存“夜灯”')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /雨天场景预览/ }))
    expect(onChange).toHaveBeenLastCalledWith(rainColors)
    onChange.mockClear()
    await user.click(screen.getByRole('button', { name: '删除预设 雨天' }))
    expect(onDeletePreset).toHaveBeenCalledWith('rain')
    expect(onChange).not.toHaveBeenCalled()

    unmount()
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:rain')
  })
})
