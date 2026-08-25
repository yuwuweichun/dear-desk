import { useEffect, useRef } from 'react'

import { getNotebookTransitionDuration } from '../scene/notebook-transition'
import type {
  JournalTurnPhase,
  NotebookPhase,
  PastTracesPhase,
} from '../state/app-store'
import {
  NOTEBOOK_CLOSE_SOUND_DURATION_SECONDS,
  type AudioController,
} from './audio-controller'

interface AudioRuntimeProps {
  controller: AudioController
  journalTurnPhase: JournalTurnPhase
  notebookPhase: NotebookPhase
  pastTracesPhase: PastTracesPhase
}

export function AudioRuntime({
  controller,
  journalTurnPhase,
  notebookPhase,
  pastTracesPhase,
}: AudioRuntimeProps) {
  const previousNotebookPhase = useRef(notebookPhase)
  const previousJournalTurnPhase = useRef(journalTurnPhase)
  const previousPastTracesPhase = useRef(pastTracesPhase)

  useEffect(() => {
    if (previousNotebookPhase.current === notebookPhase) return
    previousNotebookPhase.current = notebookPhase
    if (notebookPhase === 'opening') {
      controller.playSfx('notebook-open')
    } else if (notebookPhase === 'closing') {
      const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
      const transitionSeconds = getNotebookTransitionDuration(
        'closing',
        reducedMotion,
        window.innerWidth < 700,
      )
      controller.playSfx(
        'notebook-close',
        Math.max(0, transitionSeconds - NOTEBOOK_CLOSE_SOUND_DURATION_SECONDS) * 1000,
      )
    }
  }, [controller, notebookPhase])

  useEffect(() => {
    if (previousJournalTurnPhase.current === journalTurnPhase) return
    previousJournalTurnPhase.current = journalTurnPhase
    if (journalTurnPhase === 'turning') controller.playSfx('page-turn')
  }, [controller, journalTurnPhase])

  useEffect(() => {
    if (previousPastTracesPhase.current === pastTracesPhase) return
    previousPastTracesPhase.current = pastTracesPhase
    if (pastTracesPhase === 'opening') controller.playSfx('drawer-open')
    if (pastTracesPhase === 'closing') controller.playSfx('drawer-close')
  }, [controller, pastTracesPhase])

  return null
}
