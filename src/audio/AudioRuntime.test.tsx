import { render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import type { AudioController } from './audio-controller'
import { AudioRuntime } from './AudioRuntime'

const createController = () => ({
  dispose: vi.fn(),
  playSfx: vi.fn(),
  setPreferences: vi.fn(),
}) satisfies AudioController

describe('audio runtime state edges', () => {
  it('plays the four immediate effects only after entering successful phases', () => {
    const controller = createController()
    const { rerender } = render(
      <AudioRuntime
        controller={controller}
        journalTurnPhase="idle"
        notebookPhase="desk"
        pastTracesPhase="closed"
      />,
    )

    expect(controller.playSfx).not.toHaveBeenCalled()

    rerender(<AudioRuntime controller={controller} journalTurnPhase="idle" notebookPhase="opening" pastTracesPhase="closed" />)
    rerender(<AudioRuntime controller={controller} journalTurnPhase="turning" notebookPhase="opening" pastTracesPhase="closed" />)
    rerender(<AudioRuntime controller={controller} journalTurnPhase="idle" notebookPhase="opening" pastTracesPhase="opening" />)
    rerender(<AudioRuntime controller={controller} journalTurnPhase="idle" notebookPhase="opening" pastTracesPhase="closing" />)

    expect(controller.playSfx.mock.calls).toEqual([
      ['notebook-open'],
      ['page-turn'],
      ['drawer-open'],
      ['drawer-close'],
    ])
  })

  it('delays the close impact to the end of the notebook animation', () => {
    const controller = createController()
    const { rerender } = render(
      <AudioRuntime
        controller={controller}
        journalTurnPhase="idle"
        notebookPhase="editing"
        pastTracesPhase="closed"
      />,
    )

    rerender(<AudioRuntime controller={controller} journalTurnPhase="idle" notebookPhase="closing" pastTracesPhase="closed" />)

    expect(controller.playSfx).toHaveBeenCalledWith(
      'notebook-close',
      expect.any(Number),
    )
    expect(controller.playSfx.mock.calls[0]?.[1]).toBeCloseTo(424)
  })
})
