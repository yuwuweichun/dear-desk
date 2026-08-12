import { BookOpen, Sticker } from 'lucide-react'
import { lazy, Suspense, useEffect } from 'react'

import { formatLocalDate } from '../domain/daily-entry'
import { JournalPanel } from '../features/journal/JournalPanel'
import { StickerControls } from '../features/stickers/StickerControls'
import { StickerStudio } from '../features/stickers/StickerStudio'
import { DeskScene } from '../scene/DeskScene'
import { useAppStore } from '../state/app-store-context'
import { Button } from '../ui'

type ModelReviewKind = 'desk' | 'mat' | 'notebook'

const DevModelReviewScene = import.meta.env.DEV
  ? lazy(async () => {
      const module = await import('../scene/ModelReviewScene')
      return { default: module.ModelReviewScene }
    })
  : null

function SceneFallback() {
  const openNotebookWithoutScene = useAppStore(
    (state) => state.openNotebookWithoutScene,
  )

  return (
    <div className="scene-fallback" role="status">
      <span>3D 桌面暂时不可用</span>
      <Button
        icon={<BookOpen aria-hidden="true" size={18} />}
        onClick={openNotebookWithoutScene}
        variant="primary"
      >
        打开本子
      </Button>
    </div>
  )
}

function ProductApp() {
  const selectedDate = useAppStore((state) => state.selectedDate)
  const entry = useAppStore((state) => state.entry)
  const loadStatus = useAppStore((state) => state.loadStatus)
  const loadToday = useAppStore((state) => state.loadToday)
  const loadStickers = useAppStore((state) => state.loadStickers)
  const notebookPhase = useAppStore((state) => state.notebookPhase)
  const requestNotebookOpen = useAppStore((state) => state.requestNotebookOpen)
  const openStickerStudio = useAppStore((state) => state.openStickerStudio)
  const settleNotebookTransition = useAppStore(
    (state) => state.settleNotebookTransition,
  )
  const stickerWorkflow = useAppStore((state) => state.stickerWorkflow)
  const selectedStickerId = useAppStore((state) => state.selectedStickerId)

  useEffect(() => {
    void loadToday()
    void loadStickers()
  }, [loadStickers, loadToday])

  useEffect(() => {
    const settleWhenHidden = () => {
      if (document.visibilityState === 'hidden') settleNotebookTransition()
    }
    document.addEventListener('visibilitychange', settleWhenHidden)
    return () => document.removeEventListener('visibilitychange', settleWhenHidden)
  }, [settleNotebookTransition])

  const entryState =
    loadStatus === 'loading'
      ? '正在打开'
      : loadStatus === 'error'
        ? '本地记录不可用'
        : entry
          ? '今天有一页'
          : '今天还是空白'

  const showDeskActions =
    notebookPhase === 'desk' &&
    stickerWorkflow === 'idle' &&
    !selectedStickerId

  return (
    <main
      className="app-shell"
      data-notebook-phase={notebookPhase}
      data-sticker-workflow={stickerWorkflow}
    >
      {stickerWorkflow === 'composing' ? (
        <StickerStudio />
      ) : (
        <div className="scene-shell">
          <DeskScene fallback={<SceneFallback />} />
        </div>
      )}

      <div
        className={showDeskActions ? 'date-block' : 'date-block is-hidden'}
        aria-live="polite"
      >
        <span>{formatLocalDate(selectedDate)}</span>
        <strong>{entryState}</strong>
      </div>

      {showDeskActions ? (
        <div className="desk-actions">
          <Button
            className="notebook-button"
            icon={<BookOpen aria-hidden="true" size={19} strokeWidth={1.8} />}
            onClick={requestNotebookOpen}
            variant="primary"
          >
            <span>打开本子</span>
          </Button>
          <Button
            className="sticker-workbench-button"
            icon={<Sticker aria-hidden="true" size={19} strokeWidth={1.8} />}
            onClick={openStickerStudio}
            variant="secondary"
          >
            <span>贴纸工作台</span>
          </Button>
        </div>
      ) : null}

      <JournalPanel />
      {stickerWorkflow !== 'composing' ? <StickerControls /> : null}
    </main>
  )
}

const getDevModelReview = () => {
  if (!import.meta.env.DEV) return null
  const query = new URLSearchParams(window.location.search)
  const review = query.get('review')
  if (review !== 'desk' && review !== 'mat' && review !== 'notebook') {
    return null
  }
  const model: ModelReviewKind = review

  return {
    light: query.get('light'),
    model,
    pass: query.get('pass'),
    state: query.get('state'),
    view: query.get('view'),
  }
}

export function App() {
  const review = getDevModelReview()
  if (review && DevModelReviewScene) {
    return (
      <Suspense fallback={null}>
        <DevModelReviewScene {...review} />
      </Suspense>
    )
  }
  return <ProductApp />
}
