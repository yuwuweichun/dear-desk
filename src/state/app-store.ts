import { createStore } from 'zustand/vanilla'

import type {
  DailyEntry,
  DailyEntryRepository,
  LocalDate,
} from '../domain/daily-entry'

type LoadStatus = 'idle' | 'loading' | 'ready' | 'error'
type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

export type NotebookPhase =
  | 'desk'
  | 'approaching'
  | 'opening'
  | 'editing'
  | 'closing'
  | 'retreating'

const nextNotebookPhase: Partial<Record<NotebookPhase, NotebookPhase>> = {
  approaching: 'opening',
  opening: 'editing',
  closing: 'retreating',
  retreating: 'desk',
}

export interface AppState {
  selectedDate: LocalDate
  entry: DailyEntry | null
  notebookPhase: NotebookPhase
  loadStatus: LoadStatus
  saveStatus: SaveStatus
  errorMessage: string | null
  loadToday: () => Promise<void>
  requestNotebookOpen: () => void
  advanceNotebookPhase: (from: NotebookPhase) => void
  requestNotebookClose: () => void
  openNotebookWithoutScene: () => void
  settleNotebookTransition: () => void
  saveEntry: (text: string) => Promise<boolean>
  resetSaveStatus: () => void
}

const messageFromError = (error: unknown, fallback: string) =>
  error instanceof Error && error.message ? error.message : fallback

export const createAppStore = (
  repository: DailyEntryRepository,
  selectedDate: LocalDate,
) =>
  createStore<AppState>()((set, get) => ({
    selectedDate,
    entry: null,
    notebookPhase: 'desk',
    loadStatus: 'idle',
    saveStatus: 'idle',
    errorMessage: null,

    loadToday: async () => {
      set({ loadStatus: 'loading', errorMessage: null })
      try {
        const entry = await repository.getByDate(get().selectedDate)
        set({ entry, loadStatus: 'ready' })
      } catch (error) {
        set({
          loadStatus: 'error',
          errorMessage: messageFromError(error, '今天的记录暂时无法读取。'),
        })
      }
    },

    requestNotebookOpen: () =>
      set((state) =>
        state.notebookPhase === 'desk'
          ? { notebookPhase: 'approaching' }
          : state,
      ),

    advanceNotebookPhase: (from) =>
      set((state) => {
        const nextPhase = nextNotebookPhase[from]
        return state.notebookPhase === from && nextPhase
          ? { notebookPhase: nextPhase }
          : state
      }),

    requestNotebookClose: () =>
      set((state) =>
        state.notebookPhase === 'editing'
          ? { notebookPhase: 'closing' }
          : state,
      ),

    openNotebookWithoutScene: () =>
      set((state) =>
        ['desk', 'approaching', 'opening'].includes(state.notebookPhase)
          ? { notebookPhase: 'editing' }
          : state,
      ),

    settleNotebookTransition: () =>
      set((state) => {
        if (state.notebookPhase === 'approaching' || state.notebookPhase === 'opening') {
          return { notebookPhase: 'editing' }
        }
        if (state.notebookPhase === 'closing' || state.notebookPhase === 'retreating') {
          return { notebookPhase: 'desk' }
        }
        return state
      }),

    saveEntry: async (text) => {
      set({ saveStatus: 'saving', errorMessage: null })
      try {
        const entry = await repository.save(get().selectedDate, text)
        set({ entry, saveStatus: 'saved' })
        return true
      } catch (error) {
        set({
          saveStatus: 'error',
          errorMessage: messageFromError(error, '这次没有保存成功，请再试一次。'),
        })
        return false
      }
    },

    resetSaveStatus: () => set({ saveStatus: 'idle', errorMessage: null }),
  }))

export type AppStore = ReturnType<typeof createAppStore>
