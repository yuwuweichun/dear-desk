import type { NotebookPhase } from '../state/app-store'

export type AnimatedNotebookPhase = Extract<
  NotebookPhase,
  'approaching' | 'opening' | 'closing' | 'retreating'
>

const standardDurations: Record<AnimatedNotebookPhase, number> = {
  approaching: 1.4,
  opening: 1.52,
  closing: 0.52,
  retreating: 1.02,
}

const compactViewportDurations: Record<AnimatedNotebookPhase, number> = {
  approaching: 0.84,
  opening: 0.9,
  closing: 0.32,
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

export const getDeskCameraTransitionDuration = (
  reducedMotion: boolean,
  compactViewport = false,
) => reducedMotion ? 0.06 : compactViewport ? 0.48 : 0.72

export const isNotebookModelVisible = (phase: NotebookPhase) =>
  phase !== 'editing'
