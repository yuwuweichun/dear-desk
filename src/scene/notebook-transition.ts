import type { NotebookPhase } from '../state/app-store'

export type AnimatedNotebookPhase = Extract<
  NotebookPhase,
  'approaching' | 'opening' | 'closing' | 'retreating'
>

const standardDurations: Record<AnimatedNotebookPhase, number> = {
  approaching: 1.15,
  opening: 0.68,
  closing: 0.52,
  retreating: 0.78,
}

const compactViewportDurations: Record<AnimatedNotebookPhase, number> = {
  approaching: 0.68,
  opening: 0.4,
  closing: 0.32,
  retreating: 0.46,
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

export const isNotebookModelVisible = (phase: NotebookPhase) =>
  phase !== 'editing'
