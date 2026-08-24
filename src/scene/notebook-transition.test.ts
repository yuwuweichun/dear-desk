import {
  easeInOutCubic,
  getDeskCameraTransitionDuration,
  getNotebookPageFlutterState,
  getNotebookPresentationState,
  getNotebookTransitionDuration,
  isNotebookModelVisible,
  NOTEBOOK_PAGE_FLUTTER_COUNT,
} from './notebook-transition'

describe('notebook transition timing', () => {
  it('keeps the standard opening and closing sequences within the approved rhythm', () => {
    const opening =
      getNotebookTransitionDuration('approaching', false) +
      getNotebookTransitionDuration('opening', false)
    const closing =
      getNotebookTransitionDuration('closing', false) +
      getNotebookTransitionDuration('retreating', false)

    expect(opening).toBeCloseTo(3)
    expect(closing).toBeCloseTo(2.14)
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

    expect(opening).toBeCloseTo(1.88)
    expect(closing).toBeCloseTo(1.34)
  })

  it('eases between exact stable endpoints', () => {
    expect(easeInOutCubic(0)).toBe(0)
    expect(easeInOutCubic(0.5)).toBe(0.5)
    expect(easeInOutCubic(1)).toBe(1)
  })

  it('rises before spreading and returns flat at the centered open endpoint', () => {
    expect(getNotebookPresentationState(0)).toEqual({
      settleProgress: 0,
      spineCenterProgress: 0,
      spreadProgress: 0,
      uprightProgress: 0,
    })

    const upright = getNotebookPresentationState(0.3)
    expect(upright.uprightProgress).toBeCloseTo(1)
    expect(upright.spineCenterProgress).toBeCloseTo(1)
    expect(upright.spreadProgress).toBe(0)

    const spreading = getNotebookPresentationState(0.6)
    expect(spreading.spreadProgress).toBeGreaterThan(0)
    expect(spreading.spreadProgress).toBeLessThan(1)
    expect(spreading.uprightProgress).toBeGreaterThan(0)

    expect(getNotebookPresentationState(1)).toEqual({
      settleProgress: 1,
      spineCenterProgress: 1,
      spreadProgress: 1,
      uprightProgress: 0,
    })
  })

  it('keeps the left and right halves mirrored throughout the spread', () => {
    for (const progress of [0.3, 0.45, 0.6, 0.75, 0.9]) {
      const presentation = getNotebookPresentationState(progress)
      const rightWorldAngle = Math.PI / 2 * presentation.uprightProgress
      const leftWorldAngle = rightWorldAngle + Math.PI * presentation.spreadProgress
      expect(Math.PI / 2 - rightWorldAngle).toBeCloseTo(
        leftWorldAngle - Math.PI / 2,
      )
    }
  })

  it('staggers five opening pages through one ordered flutter window', () => {
    expect(NOTEBOOK_PAGE_FLUTTER_COUNT).toBe(5)
    expect(
      Array.from({ length: NOTEBOOK_PAGE_FLUTTER_COUNT }, (_, index) =>
        getNotebookPageFlutterState(0, index).visible),
    ).toEqual([false, false, false, false, false])

    const flutter = Array.from(
      { length: NOTEBOOK_PAGE_FLUTTER_COUNT },
      (_, index) => getNotebookPageFlutterState(0.7, index),
    )
    expect(flutter.every((page) => page.visible)).toBe(true)
    expect(flutter.map((page) => page.progress)).toEqual(
      [...flutter]
        .map((page) => page.progress)
        .sort((left, right) => right - left),
    )
    expect(flutter.every((page) => page.liftProgress > 0)).toBe(true)

    expect(
      Array.from({ length: NOTEBOOK_PAGE_FLUTTER_COUNT }, (_, index) =>
        getNotebookPageFlutterState(1, index).visible),
    ).toEqual([false, false, false, false, false])
  })

  it('derives reversible flutter poses from the normalized notebook progress', () => {
    const progressSamples = [0.46, 0.58, 0.72, 0.9]
    const openingTrace = progressSamples.map((progress) =>
      Array.from({ length: NOTEBOOK_PAGE_FLUTTER_COUNT }, (_, index) =>
        getNotebookPageFlutterState(progress, index)),
    )
    const closingTrace = [...progressSamples]
      .reverse()
      .map((progress) =>
        Array.from({ length: NOTEBOOK_PAGE_FLUTTER_COUNT }, (_, index) =>
          getNotebookPageFlutterState(progress, index)),
      )
      .reverse()
    expect(closingTrace).toEqual(openingTrace)

    expect(getNotebookPageFlutterState(-1, 0)).toEqual(
      getNotebookPageFlutterState(0, 0),
    )
    expect(getNotebookPageFlutterState(2, 4)).toEqual(
      getNotebookPageFlutterState(1, 4),
    )
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
