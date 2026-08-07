import { createStore } from 'zustand/vanilla'

import type {
  DailyEntry,
  DailyEntryRepository,
  LocalDate,
} from '../domain/daily-entry'
import {
  clampStickerPosition,
  normalizeStickerText,
  STICKER_ROTATION_STEP,
  type PlacedSticker,
  type StickerDraft,
  type StickerPosition,
  type StickerRepository,
} from '../domain/sticker'

type LoadStatus = 'idle' | 'loading' | 'ready' | 'error'
type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'
type StickerStatus = 'idle' | 'loading' | 'saving' | 'error'

export type StickerWorkflow = 'idle' | 'composing' | 'placing'

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
  stickers: PlacedSticker[]
  stickerWorkflow: StickerWorkflow
  stickerStatus: StickerStatus
  stickerErrorMessage: string | null
  stickerDraftText: string | null
  pendingSticker: StickerDraft | null
  selectedStickerId: string | null
  loadToday: () => Promise<void>
  loadStickers: () => Promise<void>
  requestNotebookOpen: () => void
  advanceNotebookPhase: (from: NotebookPhase) => void
  requestNotebookClose: () => void
  openNotebookWithoutScene: () => void
  settleNotebookTransition: () => void
  saveEntry: (text: string) => Promise<boolean>
  resetSaveStatus: () => void
  startStickerComposer: (text: string) => boolean
  cancelStickerComposer: () => void
  prepareStickerPlacement: (draft: StickerDraft) => void
  cancelStickerPlacement: () => void
  placePendingSticker: (position: StickerPosition) => Promise<boolean>
  selectSticker: (instanceId: string | null) => void
  previewStickerPosition: (instanceId: string, position: StickerPosition) => void
  commitStickerPosition: (
    instanceId: string,
    position: StickerPosition,
  ) => Promise<boolean>
  rotateSelectedSticker: (direction: -1 | 1) => Promise<boolean>
  deleteSelectedSticker: () => Promise<boolean>
  clearStickerError: () => void
}

const messageFromError = (error: unknown, fallback: string) =>
  error instanceof Error && error.message ? error.message : fallback

export const createAppStore = (
  repository: DailyEntryRepository,
  selectedDate: LocalDate,
  stickerRepository: StickerRepository = {
    create: async () => {
      throw new Error('贴纸存储不可用。')
    },
    delete: async () => undefined,
    list: async () => [],
    move: async () => {
      throw new Error('贴纸存储不可用。')
    },
    rotate: async () => {
      throw new Error('贴纸存储不可用。')
    },
  },
) =>
  createStore<AppState>()((set, get) => ({
    selectedDate,
    entry: null,
    notebookPhase: 'desk',
    loadStatus: 'idle',
    saveStatus: 'idle',
    errorMessage: null,
    stickers: [],
    stickerWorkflow: 'idle',
    stickerStatus: 'idle',
    stickerErrorMessage: null,
    stickerDraftText: null,
    pendingSticker: null,
    selectedStickerId: null,

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

    loadStickers: async () => {
      set({ stickerStatus: 'loading', stickerErrorMessage: null })
      try {
        set({ stickers: await stickerRepository.list(), stickerStatus: 'idle' })
      } catch (error) {
        set({
          stickerStatus: 'error',
          stickerErrorMessage: messageFromError(
            error,
            '桌面贴纸暂时无法读取。',
          ),
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
          ? { notebookPhase: 'closing', stickerDraftText: null }
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
        set({ entry, saveStatus: 'saved', stickerDraftText: null })
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

    startStickerComposer: (text) => {
      try {
        const normalized = normalizeStickerText(text)
        if (get().notebookPhase !== 'editing') return false
        set({
          notebookPhase: 'desk',
          stickerDraftText: normalized,
          stickerErrorMessage: null,
          stickerWorkflow: 'composing',
          selectedStickerId: null,
        })
        return true
      } catch (error) {
        set({
          stickerErrorMessage: messageFromError(
            error,
            '这段文字暂时不能制作成贴纸。',
          ),
        })
        return false
      }
    },

    cancelStickerComposer: () =>
      set({
        notebookPhase: 'editing',
        stickerErrorMessage: null,
        stickerWorkflow: 'idle',
      }),

    prepareStickerPlacement: (draft) =>
      set({
        notebookPhase: 'desk',
        pendingSticker: draft,
        stickerDraftText: null,
        stickerErrorMessage: null,
        stickerWorkflow: 'placing',
      }),

    cancelStickerPlacement: () =>
      set({
        pendingSticker: null,
        stickerErrorMessage: null,
        stickerWorkflow: 'idle',
      }),

    placePendingSticker: async (position) => {
      const draft = get().pendingSticker
      if (!draft) return false
      set({ stickerStatus: 'saving', stickerErrorMessage: null })
      try {
        const sticker = await stickerRepository.create(
          draft,
          clampStickerPosition(position),
        )
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

    selectSticker: (instanceId) =>
      set((state) => ({
        selectedStickerId:
          state.stickerWorkflow === 'idle' ? instanceId : state.selectedStickerId,
      })),

    previewStickerPosition: (instanceId, position) =>
      set((state) => ({
        stickers: state.stickers.map((sticker) =>
          sticker.instance.id === instanceId
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

    rotateSelectedSticker: async (direction) => {
      const selected = get().stickers.find(
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
