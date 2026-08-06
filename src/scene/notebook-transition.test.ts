import {
  easeInOutCubic,
  getNotebookTransitionDuration,
} from './notebook-transition'

describe('notebook transition timing', () => {
  it('keeps the standard opening and closing sequences within the approved rhythm', () => {
    const opening =
      getNotebookTransitionDuration('approaching', false) +
      getNotebookTransitionDuration('opening', false)
    const closing =
      getNotebookTransitionDuration('closing', false) +
      getNotebookTransitionDuration('retreating', false)

    expect(opening).toBeCloseTo(1.83)
    expect(closing).toBeCloseTo(1.3)
  })

  it('settles each reduced-motion direction in no more than 150ms', () => {
    const opening =
      getNotebookTransitionDuration('approaching', true) +
      getNotebookTransitionDuration('opening', true)
    const closing =
      getNotebookTransitionDuration('closing', true) +
      getNotebookTransitionDuration('retreating', true)

    expect(opening).toBeLessThanOrEqual(0.15)
    expect(closing).toBeLessThanOrEqual(0.15)
  })

  it('uses a shorter schedule for compact high-DPR viewports', () => {
    const opening =
      getNotebookTransitionDuration('approaching', false, true) +
      getNotebookTransitionDuration('opening', false, true)
    const closing =
      getNotebookTransitionDuration('closing', false, true) +
      getNotebookTransitionDuration('retreating', false, true)

    expect(opening).toBeCloseTo(1.08)
    expect(closing).toBeCloseTo(0.78)
  })

  it('eases between exact stable endpoints', () => {
    expect(easeInOutCubic(0)).toBe(0)
    expect(easeInOutCubic(0.5)).toBe(0.5)
    expect(easeInOutCubic(1)).toBe(1)
  })
})
