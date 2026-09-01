import { createStore } from 'zustand/vanilla'

import type {
  DailyEntry,
  DailyEntryRepository,
  LocalDate,
} from '../domain/daily-entry'
import { sortLocalDates } from '../domain/daily-entry'
import {
  buildPastTraceSummaries,
  type PastTraceSummary,
} from '../domain/past-trace'
import type {
  NotebookCoverSettings,
  NotebookCoverSettingsRepository,
} from '../domain/notebook-cover-settings'
import {
  clampJournalStickerPosition,
  clampStickerPosition,
  STICKER_ROTATION_STEP,
  type JournalStickerPosition,
  type PlacedSticker,
  type StickerDraft,
  type StickerPosition,
  type StickerRepository,
} from '../domain/sticker'

type LoadStatus = 'idle' | 'loading' | 'ready' | 'error'
type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'
type StickerStatus = 'idle' | 'loading' | 'saving' | 'error'
type JournalLoadStatus = 'idle' | 'loading' | 'ready' | 'error'
type NotebookCoverStatus = 'idle' | 'loading' | 'saving' | 'ready' | 'error'
type PastTracesStatus = 'idle' | 'loading' | 'ready' | 'error'

export type JournalTurnDirection = 'previous' | 'next'
export type JournalTurnPhase = 'idle' | 'loading' | 'turning'

export type DeskCameraPreset = 'far' | 'front' | 'near'
export type PastTracesPhase = 'closed' | 'opening' | 'open' | 'closing'

const nextDeskCameraPreset: Record<DeskCameraPreset, DeskCameraPreset> = {
  far: 'front',
  front: 'near',
  near: 'far',
}

export type StickerWorkflow =
  | 'idle'
  | 'composing'
  | 'placingDesk'
  | 'placingJournal'

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
  deskCameraPreset: DeskCameraPreset
  deskCameraTransitioning: boolean
  freeCameraEnabled: boolean
  loadStatus: LoadStatus
  saveStatus: SaveStatus
  errorMessage: string | null
  stickers: PlacedSticker[]
  journalStickers: PlacedSticker[]
  journalPageDates: LocalDate[]
  journalPageEntries: Record<string, DailyEntry | null>
  journalPageStickers: Record<string, PlacedSticker[]>
  journalCursor: number
  journalLoadStatus: JournalLoadStatus
  journalErrorMessage: string | null
  journalTurnDirection: JournalTurnDirection | null
  journalTurnPhase: JournalTurnPhase
  journalPendingCursor: number | null
  journalInitialDate: LocalDate | null
  pastTraces: PastTraceSummary[]
  pastTracesErrorMessage: string | null
  pastTracesPhase: PastTracesPhase
  pastTracesStatus: PastTracesStatus
  pastTracesUsesScene: boolean
  pendingJournalDate: LocalDate | null
  stickerWorkflow: StickerWorkflow
  stickerStatus: StickerStatus
  stickerErrorMessage: string | null
  notebookCoverSettings: NotebookCoverSettings | null
  notebookCoverStatus: NotebookCoverStatus
  notebookCoverErrorMessage: string | null
  pendingSticker: StickerDraft | null
  selectedStickerId: string | null
  loadToday: () => Promise<void>
  loadStickers: () => Promise<void>
  loadNotebookCoverSettings: () => Promise<void>
  saveNotebookCoverLabel: (label: string) => Promise<boolean>
  loadJournalPages: () => Promise<void>
  requestJournalTurn: (direction: JournalTurnDirection) => Promise<boolean>
  settleJournalTurn: () => void
  requestNotebookOpen: () => void
  loadPastTraces: () => Promise<void>
  requestPastTracesOpen: () => void
  openPastTracesWithoutScene: () => void
  requestPastTracesClose: () => void
  selectPastTrace: (date: LocalDate) => void
  settlePastTracesTransition: () => void
  cycleDeskCameraPreset: () => void
  toggleFreeCamera: () => void
  disableFreeCamera: () => void
  settleDeskCameraPreset: () => void
  advanceNotebookPhase: (from: NotebookPhase) => void
  requestNotebookClose: () => void
  openNotebookWithoutScene: () => void
  settleNotebookTransition: () => void
  saveEntry: (text: string, title?: string) => Promise<boolean>
  saveJournalEntry: (date: LocalDate, text: string, title?: string) => Promise<boolean>
  resetSaveStatus: () => void
  openStickerStudio: () => void
  openStickerStudioFromJournal: () => void
  cancelStickerComposer: () => void
  prepareStickerPlacement: (
    draft: StickerDraft,
    target: 'desk' | 'journal',
  ) => void
  cancelStickerPlacement: () => void
  placePendingDeskSticker: (position: StickerPosition) => Promise<boolean>
  placePendingJournalSticker: (
    position: JournalStickerPosition,
  ) => Promise<boolean>
  selectSticker: (instanceId: string | null) => void
  previewStickerPosition: (instanceId: string, position: StickerPosition) => void
  previewJournalStickerPosition: (
    instanceId: string,
    position: JournalStickerPosition,
  ) => void
  commitStickerPosition: (
    instanceId: string,
    position: StickerPosition,
  ) => Promise<boolean>
  commitJournalStickerPosition: (
    instanceId: string,
    position: JournalStickerPosition,
  ) => Promise<boolean>
  rotateSelectedSticker: (direction: -1 | 1) => Promise<boolean>
  deleteSelectedSticker: () => Promise<boolean>
  clearStickerError: () => void
}

const messageFromError = (error: unknown, fallback: string) =>
  error instanceof Error && error.message ? error.message : fallback

const unavailableStickerRepository: StickerRepository = {
  create: async () => {
    throw new Error('贴纸存储不可用。')
  },
  delete: async () => undefined,
  listDesk: async () => [],
  listJournal: async () => [],
  listJournalDateCounts: async () => [],
  listJournalDates: async () => [],
  move: async () => {
    throw new Error('贴纸存储不可用。')
  },
  rotate: async () => {
    throw new Error('贴纸存储不可用。')
  },
}

export const createAppStore = (
  repository: DailyEntryRepository,
  selectedDate: LocalDate,
  stickerRepository: StickerRepository = unavailableStickerRepository,
  notebookCoverRepository?: NotebookCoverSettingsRepository,
) =>
  createStore<AppState>()((set, get) => ({
    selectedDate,
    entry: null,
    notebookPhase: 'desk',
    deskCameraPreset: 'far',
    deskCameraTransitioning: false,
    freeCameraEnabled: true,
    loadStatus: 'idle',
    saveStatus: 'idle',
    errorMessage: null,
    stickers: [],
    journalStickers: [],
    journalPageDates: [selectedDate],
    journalPageEntries: {},
    journalPageStickers: {},
    journalCursor: 0,
    journalLoadStatus: 'idle',
    journalErrorMessage: null,
    journalTurnDirection: null,
    journalTurnPhase: 'idle',
    journalPendingCursor: null,
    journalInitialDate: null,
    pastTraces: [],
    pastTracesErrorMessage: null,
    pastTracesPhase: 'closed',
    pastTracesStatus: 'idle',
    pastTracesUsesScene: true,
    pendingJournalDate: null,
    stickerWorkflow: 'idle',
    stickerStatus: 'idle',
    stickerErrorMessage: null,
    notebookCoverSettings: null,
    notebookCoverStatus: 'idle',
    notebookCoverErrorMessage: null,
    pendingSticker: null,
    selectedStickerId: null,

    loadNotebookCoverSettings: async () => {
      if (!notebookCoverRepository) {
        set({ notebookCoverSettings: null, notebookCoverStatus: 'ready' })
        return
      }
      set({ notebookCoverStatus: 'loading', notebookCoverErrorMessage: null })
      try {
        const settings = await notebookCoverRepository.get()
        set({ notebookCoverSettings: settings, notebookCoverStatus: 'ready' })
      } catch (error) {
        set({
          notebookCoverStatus: 'error',
          notebookCoverErrorMessage: messageFromError(
            error,
            '铭牌设置暂时无法读取。',
          ),
        })
      }
    },

    saveNotebookCoverLabel: async (label) => {
      if (!notebookCoverRepository) return false
      set({ notebookCoverStatus: 'saving', notebookCoverErrorMessage: null })
      try {
        const settings = await notebookCoverRepository.save(label)
        set({ notebookCoverSettings: settings, notebookCoverStatus: 'ready' })
        return true
      } catch (error) {
        set({
          notebookCoverStatus: 'error',
          notebookCoverErrorMessage: messageFromError(
            error,
            '铭牌没有保存成功，请重试。',
          ),
        })
        return false
      }
    },

    loadToday: async () => {
      set({ loadStatus: 'loading', errorMessage: null })
      try {
        const entry = await repository.getByDate(get().selectedDate)
        set((state) => ({
          entry,
          journalPageEntries: {
            ...state.journalPageEntries,
            [state.selectedDate]: entry,
          },
          loadStatus: 'ready',
        }))
      } catch (error) {
        set({
          loadStatus: 'error',
          errorMessage: messageFromError(error, '今天的记录暂时无法读取。'),
        })
      }
    },

    loadStickers: async () => {
      set({ stickerStatus: 'loading', stickerErrorMessage: null })
      try {
        const [stickers, journalStickers] = await Promise.all([
          stickerRepository.listDesk(),
          stickerRepository.listJournal(get().selectedDate),
        ])
        set((state) => ({
          stickers,
          journalStickers,
          journalPageStickers: {
            ...state.journalPageStickers,
            [state.selectedDate]: journalStickers,
          },
          stickerStatus: 'idle',
        }))
      } catch (error) {
        set({
          stickerStatus: 'error',
          stickerErrorMessage: messageFromError(
            error,
            '贴纸暂时无法读取。',
          ),
        })
      }
    },

    loadJournalPages: async () => {
      set({ journalLoadStatus: 'loading', journalErrorMessage: null })
      try {
        const initialDate = get().journalInitialDate ?? get().selectedDate
        const [entryDates, stickerDates] = await Promise.all([
          repository.listDates(),
          stickerRepository.listJournalDates(),
        ])
        const dates = sortLocalDates([
          ...entryDates,
          ...stickerDates,
          get().selectedDate,
        ]).filter((date) => date <= get().selectedDate)
        const requestedCursor = dates.indexOf(initialDate)
        const cursor = requestedCursor >= 0
          ? requestedCursor
          : Math.max(0, dates.indexOf(get().selectedDate))
        const visibleDates = dates.slice(Math.max(0, cursor - 1), cursor + 1)
        const pages = await Promise.all(
          visibleDates.map(async (date) => ({
            date,
            entry: await repository.getByDate(date),
            stickers: await stickerRepository.listJournal(date),
          })),
        )
        const journalPageEntries: Record<string, DailyEntry | null> = {}
        const journalPageStickers: Record<string, PlacedSticker[]> = {}
        for (const page of pages) {
          journalPageEntries[page.date] = page.entry
          journalPageStickers[page.date] = page.stickers
        }
        set({
          journalPageDates: dates,
          journalPageEntries,
          journalPageStickers,
          journalCursor: cursor,
          journalLoadStatus: 'ready',
          journalTurnDirection: null,
          journalTurnPhase: 'idle',
          journalPendingCursor: null,
          journalInitialDate: null,
          journalErrorMessage: requestedCursor >= 0
            ? null
            : '这一天已不在旧痕迹中，已回到今天。',
        })
      } catch (error) {
        set({
          journalInitialDate: null,
          journalLoadStatus: 'error',
          journalErrorMessage: messageFromError(
            error,
            '过去的日记页暂时无法读取。',
          ),
        })
      }
    },

    requestJournalTurn: async (direction) => {
      const state = get()
      if (state.journalTurnPhase !== 'idle' || state.journalLoadStatus !== 'ready') {
        return false
      }
      const targetCursor = state.journalCursor + (direction === 'previous' ? -1 : 1)
      if (targetCursor < 0 || targetCursor >= state.journalPageDates.length) {
        return false
      }
      set({
        journalErrorMessage: null,
        journalTurnDirection: direction,
        journalTurnPhase: 'loading',
        journalPendingCursor: targetCursor,
      })
      try {
        const targetDates = [targetCursor - 1, targetCursor]
          .map((index) => state.journalPageDates[index])
          .filter((date): date is LocalDate => Boolean(date))
        const pages = await Promise.all(
          targetDates.map(async (date) => ({
            date,
            entry: Object.prototype.hasOwnProperty.call(state.journalPageEntries, date)
              ? state.journalPageEntries[date] ?? null
              : await repository.getByDate(date),
            stickers: Object.prototype.hasOwnProperty.call(state.journalPageStickers, date)
              ? state.journalPageStickers[date] ?? []
              : await stickerRepository.listJournal(date),
          })),
        )
        set((current) => ({
          journalPageEntries: pages.reduce<Record<string, DailyEntry | null>>(
            (entries, page) => ({ ...entries, [page.date]: page.entry }),
            current.journalPageEntries,
          ),
          journalPageStickers: pages.reduce<Record<string, PlacedSticker[]>>(
            (stickers, page) => ({ ...stickers, [page.date]: page.stickers }),
            current.journalPageStickers,
          ),
          journalTurnPhase: 'turning',
        }))
        return true
      } catch (error) {
        set({
          journalErrorMessage: messageFromError(
            error,
            '这一页暂时翻不开，请再试一次。',
          ),
          journalTurnDirection: null,
          journalTurnPhase: 'idle',
          journalPendingCursor: null,
        })
        return false
      }
    },

    settleJournalTurn: () =>
      set((state) =>
        state.journalTurnPhase === 'turning' && state.journalPendingCursor !== null
          ? {
              journalCursor: state.journalPendingCursor,
              journalTurnDirection: null,
              journalTurnPhase: 'idle',
              journalPendingCursor: null,
              selectedStickerId: null,
            }
          : state,
      ),

    requestNotebookOpen: () =>
      set((state) =>
        state.notebookPhase === 'desk' &&
        state.pastTracesPhase === 'closed' &&
        state.stickerWorkflow === 'idle' &&
        !state.deskCameraTransitioning
          ? {
              notebookPhase:
                state.freeCameraEnabled || state.deskCameraPreset !== 'near'
                  ? 'approaching'
                  : 'opening',
              freeCameraEnabled: false,
              deskCameraTransitioning: false,
              journalInitialDate: state.selectedDate,
              selectedStickerId: null,
            }
          : state,
      ),

    loadPastTraces: async () => {
      set({ pastTracesStatus: 'loading', pastTracesErrorMessage: null })
      try {
        const [entries, stickerCounts] = await Promise.all([
          repository.listEntries(),
          stickerRepository.listJournalDateCounts(),
        ])
        set({
          pastTraces: buildPastTraceSummaries(
            entries,
            stickerCounts,
            get().selectedDate,
          ),
          pastTracesStatus: 'ready',
        })
      } catch (error) {
        set({
          pastTracesStatus: 'error',
          pastTracesErrorMessage: messageFromError(
            error,
            '旧痕迹暂时无法读取。',
          ),
        })
      }
    },

    requestPastTracesOpen: () => {
      const state = get()
      if (
        state.notebookPhase !== 'desk' ||
        state.pastTracesPhase !== 'closed' ||
        state.stickerWorkflow !== 'idle' ||
        state.deskCameraTransitioning ||
        state.selectedStickerId
      ) {
        return
      }
      set({
        deskCameraTransitioning: state.freeCameraEnabled,
        freeCameraEnabled: false,
        pastTracesPhase: 'opening',
        pastTracesUsesScene: true,
        pendingJournalDate: null,
        selectedStickerId: null,
      })
      void get().loadPastTraces()
    },

    openPastTracesWithoutScene: () => {
      const state = get()
      if (
        state.notebookPhase !== 'desk' ||
        state.pastTracesPhase !== 'closed' ||
        state.stickerWorkflow !== 'idle'
      ) {
        return
      }
      set({
        freeCameraEnabled: false,
        pastTracesPhase: 'open',
        pastTracesUsesScene: false,
        pendingJournalDate: null,
        selectedStickerId: null,
      })
      void get().loadPastTraces()
    },

    requestPastTracesClose: () =>
      set((state) => {
        if (state.pastTracesPhase !== 'open') return state
        return state.pastTracesUsesScene
          ? { pastTracesPhase: 'closing', pendingJournalDate: null }
          : {
              pastTracesPhase: 'closed',
              pastTracesUsesScene: true,
              pendingJournalDate: null,
            }
      }),

    selectPastTrace: (date) =>
      set((state) => {
        if (
          state.pastTracesPhase !== 'open' ||
          !state.pastTraces.some((trace) => trace.date === date)
        ) {
          return state
        }
        if (state.pastTracesUsesScene) {
          return {
            pastTracesPhase: 'closing',
            pendingJournalDate: date,
          }
        }
        return {
          journalInitialDate: date,
          notebookPhase: 'editing',
          pastTracesPhase: 'closed',
          pastTracesUsesScene: true,
          pendingJournalDate: null,
        }
      }),

    settlePastTracesTransition: () =>
      set((state) => {
        if (state.pastTracesPhase === 'opening') {
          return { pastTracesPhase: 'open' }
        }
        if (state.pastTracesPhase !== 'closing') return state
        if (!state.pendingJournalDate) {
          return {
            pastTracesPhase: 'closed',
            pastTracesUsesScene: true,
          }
        }
        return {
          deskCameraTransitioning: false,
          freeCameraEnabled: false,
          journalInitialDate: state.pendingJournalDate,
          notebookPhase: state.deskCameraPreset === 'near' ? 'opening' : 'approaching',
          pastTracesPhase: 'closed',
          pastTracesUsesScene: true,
          pendingJournalDate: null,
          selectedStickerId: null,
        }
      }),

    cycleDeskCameraPreset: () =>
      set((state) =>
        state.notebookPhase === 'desk' &&
        state.pastTracesPhase === 'closed' &&
        state.stickerWorkflow === 'idle' &&
        !state.freeCameraEnabled &&
        !state.deskCameraTransitioning
          ? {
              deskCameraPreset: nextDeskCameraPreset[state.deskCameraPreset],
              deskCameraTransitioning: true,
              selectedStickerId: null,
            }
          : state,
      ),

    toggleFreeCamera: () =>
      set((state) => {
        if (state.freeCameraEnabled) {
          return {
            freeCameraEnabled: false,
            deskCameraTransitioning: true,
          }
        }
        return state.notebookPhase === 'desk' &&
          state.pastTracesPhase === 'closed' &&
          state.stickerWorkflow === 'idle' &&
          !state.selectedStickerId &&
          !state.deskCameraTransitioning
          ? {
              freeCameraEnabled: true,
              deskCameraTransitioning: false,
            }
          : state
      }),

    disableFreeCamera: () =>
      set((state) =>
        state.freeCameraEnabled
          ? {
              freeCameraEnabled: false,
              deskCameraTransitioning: true,
            }
          : state,
      ),

    settleDeskCameraPreset: () => set({ deskCameraTransitioning: false }),

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
          ? {
              notebookPhase: 'closing',
              pendingSticker: null,
              selectedStickerId: null,
              stickerWorkflow: 'idle',
            }
          : state,
      ),

    openNotebookWithoutScene: () =>
      set((state) =>
        state.pastTracesPhase === 'closed' &&
        ['desk', 'approaching', 'opening'].includes(state.notebookPhase)
          ? {
              notebookPhase: 'editing',
              freeCameraEnabled: false,
              deskCameraTransitioning: false,
              journalInitialDate: state.selectedDate,
            }
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

    saveEntry: async (text, title) => get().saveJournalEntry(get().selectedDate, text, title),

    saveJournalEntry: async (date, text, title) => {
      set({ saveStatus: 'saving', errorMessage: null })
      try {
        const savedEntry = await repository.save(date, text, title)
        set((state) => ({
          ...(date === state.selectedDate ? { entry: savedEntry } : {}),
          journalPageEntries: {
            ...state.journalPageEntries,
            [date]: savedEntry,
          },
          saveStatus: 'saved',
        }))
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

    openStickerStudio: () =>
      set((state) =>
        state.notebookPhase === 'desk' &&
        state.pastTracesPhase === 'closed' &&
        state.stickerWorkflow === 'idle'
          ? {
              freeCameraEnabled: false,
              deskCameraTransitioning: false,
              stickerErrorMessage: null,
              stickerWorkflow: 'composing',
              selectedStickerId: null,
            }
          : state,
      ),

    openStickerStudioFromJournal: () =>
      set((state) =>
        state.notebookPhase === 'editing' && state.stickerWorkflow === 'idle'
          ? {
              notebookPhase: 'desk',
              freeCameraEnabled: false,
              deskCameraTransitioning: false,
              pendingSticker: null,
              selectedStickerId: null,
              stickerErrorMessage: null,
              stickerWorkflow: 'composing',
            }
          : state,
      ),

    cancelStickerComposer: () =>
      set({
        notebookPhase: 'desk',
        freeCameraEnabled: false,
        deskCameraTransitioning: false,
        stickerErrorMessage: null,
        stickerWorkflow: 'idle',
      }),

    prepareStickerPlacement: (draft, target) =>
      set({
        notebookPhase: target === 'desk' ? 'desk' : 'editing',
        freeCameraEnabled: false,
        deskCameraTransitioning: false,
        pendingSticker: draft,
        selectedStickerId: null,
        stickerErrorMessage: null,
        stickerWorkflow: target === 'desk' ? 'placingDesk' : 'placingJournal',
      }),

    cancelStickerPlacement: () =>
      set((state) => ({
        notebookPhase:
          state.stickerWorkflow === 'placingJournal' ? 'editing' : 'desk',
        pendingSticker: null,
        stickerErrorMessage: null,
        stickerWorkflow: 'idle',
      })),

    placePendingDeskSticker: async (position) => {
      const draft = get().pendingSticker
      if (!draft || get().stickerWorkflow !== 'placingDesk') return false
      set({ stickerStatus: 'saving', stickerErrorMessage: null })
      try {
        const sticker = await stickerRepository.create(draft, {
          surface: 'desk',
          position: clampStickerPosition(position),
        })
        set((state) => ({
          pendingSticker: null,
          selectedStickerId: sticker.instance.id,
          stickers: [...state.stickers, sticker],
          stickerStatus: 'idle',
          stickerWorkflow: 'idle',
        }))
        return true
      } catch (error) {
        set({
          stickerStatus: 'error',
          stickerErrorMessage: messageFromError(error, '贴纸没有保存成功。'),
        })
        return false
      }
    },

    placePendingJournalSticker: async (position) => {
      const draft = get().pendingSticker
      if (!draft || get().stickerWorkflow !== 'placingJournal') return false
      set({ stickerStatus: 'saving', stickerErrorMessage: null })
      try {
        const sticker = await stickerRepository.create(draft, {
          surface: 'journal',
          journalDate: get().selectedDate,
          position: clampJournalStickerPosition(position),
        })
        set((state) => ({
          pendingSticker: null,
          selectedStickerId: sticker.instance.id,
          journalStickers: [...state.journalStickers, sticker],
          journalPageStickers: {
            ...state.journalPageStickers,
            [state.selectedDate]: [...state.journalStickers, sticker],
          },
          stickerStatus: 'idle',
          stickerWorkflow: 'idle',
        }))
        return true
      } catch (error) {
        set({
          stickerStatus: 'error',
          stickerErrorMessage: messageFromError(error, '贴纸没有保存成功。'),
        })
        return false
      }
    },

    selectSticker: (instanceId) =>
      set((state) => ({
        ...(state.pastTracesPhase === 'closed' && instanceId && state.freeCameraEnabled
          ? {
              freeCameraEnabled: false,
              deskCameraTransitioning: true,
            }
          : {}),
        selectedStickerId:
          state.pastTracesPhase === 'closed' && state.stickerWorkflow === 'idle'
            ? instanceId
            : state.selectedStickerId,
      })),

    previewStickerPosition: (instanceId, position) =>
      set((state) => ({
        stickers: state.stickers.map((sticker) =>
          sticker.instance.id === instanceId && sticker.instance.surface === 'desk'
            ? {
                ...sticker,
                instance: {
                  ...sticker.instance,
                  position: clampStickerPosition(position),
                },
              }
            : sticker,
        ),
      })),

    previewJournalStickerPosition: (instanceId, position) =>
      set((state) => ({
        journalStickers: state.journalStickers.map((sticker) =>
          sticker.instance.id === instanceId &&
          sticker.instance.surface === 'journal'
            ? {
                ...sticker,
                instance: {
                  ...sticker.instance,
                  position: clampJournalStickerPosition(position),
                },
              }
            : sticker,
        ),
      })),

    commitStickerPosition: async (instanceId, position) => {
      set({ stickerStatus: 'saving', stickerErrorMessage: null })
      try {
        const instance = await stickerRepository.move(instanceId, position)
        set((state) => ({
          stickers: state.stickers.map((sticker) =>
            sticker.instance.id === instanceId ? { ...sticker, instance } : sticker,
          ),
          stickerStatus: 'idle',
        }))
        return true
      } catch (error) {
        set({
          stickerStatus: 'error',
          stickerErrorMessage: messageFromError(error, '贴纸位置没有保存成功。'),
        })
        void get().loadStickers()
        return false
      }
    },

    commitJournalStickerPosition: async (instanceId, position) => {
      set({ stickerStatus: 'saving', stickerErrorMessage: null })
      try {
        const instance = await stickerRepository.move(instanceId, position)
        set((state) => ({
          journalStickers: state.journalStickers.map((sticker) =>
            sticker.instance.id === instanceId ? { ...sticker, instance } : sticker,
          ),
          stickerStatus: 'idle',
        }))
        return true
      } catch (error) {
        set({
          stickerStatus: 'error',
          stickerErrorMessage: messageFromError(error, '贴纸位置没有保存成功。'),
        })
        void get().loadStickers()
        return false
      }
    },

    rotateSelectedSticker: async (direction) => {
      const selected = [...get().stickers, ...get().journalStickers].find(
        (sticker) => sticker.instance.id === get().selectedStickerId,
      )
      if (!selected) return false
      set({ stickerStatus: 'saving', stickerErrorMessage: null })
      try {
        const instance = await stickerRepository.rotate(
          selected.instance.id,
          selected.instance.rotationY + STICKER_ROTATION_STEP * direction,
        )
        set((state) => ({
          stickers: state.stickers.map((sticker) =>
            sticker.instance.id === instance.id ? { ...sticker, instance } : sticker,
          ),
          journalStickers: state.journalStickers.map((sticker) =>
            sticker.instance.id === instance.id ? { ...sticker, instance } : sticker,
          ),
          stickerStatus: 'idle',
        }))
        return true
      } catch (error) {
        set({
          stickerStatus: 'error',
          stickerErrorMessage: messageFromError(error, '贴纸方向没有保存成功。'),
        })
        return false
      }
    },

    deleteSelectedSticker: async () => {
      const instanceId = get().selectedStickerId
      if (!instanceId) return false
      set({ stickerStatus: 'saving', stickerErrorMessage: null })
      try {
        await stickerRepository.delete(instanceId)
        set((state) => ({
          selectedStickerId: null,
          stickers: state.stickers.filter(
            (sticker) => sticker.instance.id !== instanceId,
          ),
          journalStickers: state.journalStickers.filter(
            (sticker) => sticker.instance.id !== instanceId,
          ),
          stickerStatus: 'idle',
        }))
        return true
      } catch (error) {
        set({
          stickerStatus: 'error',
          stickerErrorMessage: messageFromError(error, '贴纸没有删除成功。'),
        })
        return false
      }
    },

    clearStickerError: () => set({ stickerErrorMessage: null }),
  }))

export type AppStore = ReturnType<typeof createAppStore>
