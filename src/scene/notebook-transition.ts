import type { NotebookPhase } from '../state/app-store'

export type AnimatedNotebookPhase = Extract<
  NotebookPhase,
  'approaching' | 'opening' | 'closing' | 'retreating'
>

const standardDurations: Record<AnimatedNotebookPhase, number> = {
  approaching: 1.4,
  opening: 1.6,
  closing: 1.12,
  retreating: 1.02,
}

const compactViewportDurations: Record<AnimatedNotebookPhase, number> = {
  approaching: 0.84,
  opening: 1.04,
  closing: 0.72,
  retreating: 0.62,
}

const reducedMotionDurations: Record<AnimatedNotebookPhase, number> = {
  approaching: 0.06,
  opening: 0.06,
  closing: 0.06,
  retreating: 0.06,
}

export const getNotebookTransitionDuration = (
  phase: AnimatedNotebookPhase,
  reducedMotion: boolean,
  compactViewport = false,
) =>
  (
    reducedMotion
      ? reducedMotionDurations
      : compactViewport
        ? compactViewportDurations
        : standardDurations
  )[phase]

export const easeInOutCubic = (progress: number) =>
  progress < 0.5
    ? 4 * progress * progress * progress
    : 1 - Math.pow(-2 * progress + 2, 3) / 2

const clamp01 = (value: number) => Math.min(1, Math.max(0, value))

const smoothstep = (value: number, start: number, end: number) => {
  const progress = clamp01((value - start) / (end - start))
  return progress * progress * (3 - 2 * progress)
}

export interface NotebookPresentationState {
  settleProgress: number
  spineCenterProgress: number
  spreadProgress: number
  uprightProgress: number
}

export const getNotebookPresentationState = (
  progress: number,
): NotebookPresentationState => {
  const normalized = clamp01(progress)
  const riseProgress = smoothstep(normalized, 0, 0.3)
  const spreadProgress = smoothstep(normalized, 0.3, 0.9)

  return {
    settleProgress: smoothstep(normalized, 0.82, 1),
    spineCenterProgress: riseProgress,
    spreadProgress,
    uprightProgress: riseProgress * (1 - spreadProgress),
  }
}

export const getDeskCameraTransitionDuration = (
  reducedMotion: boolean,
  compactViewport = false,
) => reducedMotion ? 0.06 : compactViewport ? 0.48 : 0.72

export const isNotebookModelVisible = (
  phase: NotebookPhase,
) => phase !== 'editing'
