import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { getSceneColorConfig } from './models/material-library'
import { isSceneHexColor, serializeSceneColors } from './scene-color'
import { SceneColorEditor } from './SceneColorEditor'

describe('SceneColorEditor', () => {
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
})
