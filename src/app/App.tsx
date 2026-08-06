import { BookOpen, Database } from 'lucide-react'
import { useEffect } from 'react'

import { formatLocalDate } from '../domain/daily-entry'
import { JournalPanel } from '../features/journal/JournalPanel'
import { DeskScene } from '../scene/DeskScene'
import { useAppStore } from '../state/app-store-context'

function SceneFallback() {
  const openNotebookWithoutScene = useAppStore(
    (state) => state.openNotebookWithoutScene,
  )

  return (
    <div className="scene-fallback" role="status">
      <span>3D 桌面暂时不可用</span>
      <button type="button" onClick={openNotebookWithoutScene}>
        <BookOpen aria-hidden="true" size={18} />
        打开本子
      </button>
    </div>
  )
}

export function App() {
  const selectedDate = useAppStore((state) => state.selectedDate)
  const entry = useAppStore((state) => state.entry)
  const loadStatus = useAppStore((state) => state.loadStatus)
  const loadToday = useAppStore((state) => state.loadToday)
  const notebookPhase = useAppStore((state) => state.notebookPhase)
  const requestNotebookOpen = useAppStore((state) => state.requestNotebookOpen)
  const settleNotebookTransition = useAppStore(
    (state) => state.settleNotebookTransition,
  )

  useEffect(() => {
    void loadToday()
  }, [loadToday])

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

  return (
    <main className="app-shell" data-notebook-phase={notebookPhase}>
      <div className="scene-shell">
        <DeskScene fallback={<SceneFallback />} />
      </div>

      <header className="app-header">
        <a className="app-brand" href="/" aria-label="Dear Desk 首页">
          <span className="brand-monogram" aria-hidden="true">DD</span>
          <span>Dear Desk</span>
        </a>
        <div className="local-status" title="数据保存在当前浏览器">
          <Database aria-hidden="true" size={15} strokeWidth={1.8} />
          <span>本地</span>
        </div>
      </header>

      <div
        className={
          notebookPhase === 'desk' ? 'date-block' : 'date-block is-hidden'
        }
        aria-live="polite"
      >
        <span>{formatLocalDate(selectedDate)}</span>
        <strong>{entryState}</strong>
      </div>

      {notebookPhase === 'desk' ? (
        <button
          className="notebook-button"
          type="button"
          onClick={requestNotebookOpen}
        >
          <BookOpen aria-hidden="true" size={19} strokeWidth={1.8} />
          <span>打开本子</span>
        </button>
      ) : null}

      <JournalPanel />
    </main>
  )
}
