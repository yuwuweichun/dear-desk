import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { Button, SegmentedControl, TextInput } from '.'

describe('Dear Desk UI adapters', () => {
  it('preserves native button and loading semantics', async () => {
    const onClick = vi.fn()
    const user = userEvent.setup()
    const { rerender } = render(<Button onClick={onClick}>保存</Button>)

    await user.click(screen.getByRole('button', { name: '保存' }))
    expect(onClick).toHaveBeenCalledOnce()

    rerender(<Button loading>保存中</Button>)
    expect(screen.getByRole('button', { name: '保存中' })).toBeDisabled()
  })

  it('exposes segmented selection and input changes to business code', async () => {
    const onModeChange = vi.fn()
    const onInputChange = vi.fn()
    const user = userEvent.setup()
    render(
      <>
        <SegmentedControl
          ariaLabel="模式"
          onChange={onModeChange}
          options={[
            { label: '阅读', value: 'reading' },
            { label: '编辑', value: 'editing' },
          ]}
          value="reading"
        />
        <TextInput aria-label="标题" onChange={onInputChange} />
      </>,
    )

    expect(screen.getByRole('button', { name: '阅读' })).toHaveAttribute('aria-pressed', 'true')
    await user.click(screen.getByRole('button', { name: '编辑' }))
    expect(onModeChange).toHaveBeenCalledWith('editing')
    await user.type(screen.getByRole('textbox', { name: '标题' }), '纸页')
    expect(onInputChange).toHaveBeenCalled()
  })
})
