import {
  easeInOutCubic,
  getDeskCameraTransitionDuration,
  getNotebookTransitionDuration,
  isNotebookModelVisible,
} from './notebook-transition'

describe('notebook transition timing', () => {
  it('keeps the standard opening and closing sequences within the approved rhythm', () => {
    const opening =
      getNotebookTransitionDuration('approaching', false) +
      getNotebookTransitionDuration('opening', false)
    const closing =
      getNotebookTransitionDuration('closing', false) +
      getNotebookTransitionDuration('retreating', false)

    expect(opening).toBeCloseTo(2.92)
    expect(closing).toBeCloseTo(1.54)
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

    expect(opening).toBeCloseTo(1.74)
    expect(closing).toBeCloseTo(0.94)
  })

  it('eases between exact stable endpoints', () => {
    expect(easeInOutCubic(0)).toBe(0)
    expect(easeInOutCubic(0.5)).toBe(0.5)
    expect(easeInOutCubic(1)).toBe(1)
  })

  it('uses a compact and reduced schedule for one-preset camera switches', () => {
    expect(getDeskCameraTransitionDuration(false)).toBeCloseTo(0.72)
    expect(getDeskCameraTransitionDuration(false, true)).toBeCloseTo(0.48)
    expect(getDeskCameraTransitionDuration(true)).toBeLessThanOrEqual(0.06)
  })

  it('hides the 3D notebook only while the DOM journal owns the open pages', () => {
    expect(isNotebookModelVisible('editing')).toBe(false)
    for (const phase of [
      'desk',
      'approaching',
      'opening',
      'closing',
      'retreating',
    ] as const) {
      expect(isNotebookModelVisible(phase)).toBe(true)
    }
  })
})
