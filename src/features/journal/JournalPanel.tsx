import { Save, X } from 'lucide-react'
import { useEffect, useState } from 'react'

import { formatLocalDate, MAX_ENTRY_LENGTH, type LocalDate } from '../../domain/daily-entry'
import type { PlacedSticker } from '../../domain/sticker'
import type { JournalTurnDirection } from '../../state/app-store'
import { useAppStore } from '../../state/app-store-context'
import {
  HistoricalJournalPage,
  InsideCoverPage,
  JournalPageFrame,
} from './JournalPage'
import { JournalStickerLayer } from './JournalStickerLayer'
import { PageTurnSheet } from './PageTurnSheet'

export function JournalPanel() {
  const notebookPhase = useAppStore((state) => state.notebookPhase)
  const selectedDate = useAppStore((state) => state.selectedDate)
  const entry = useAppStore((state) => state.entry)

  if (notebookPhase !== 'editing') return null

  return (
    <JournalBook
      key={`${selectedDate}-${entry?.updatedAt ?? 'empty'}`}
      initialDraft={entry?.text ?? ''}
    />
  )
}

interface JournalBookProps {
  initialDraft: string
}

function JournalBook({ initialDraft }: JournalBookProps) {
  const selectedDate = useAppStore((state) => state.selectedDate)
  const entry = useAppStore((state) => state.entry)
  const journalStickers = useAppStore((state) => state.journalStickers)
  const journalPageDates = useAppStore((state) => state.journalPageDates)
  const journalPageEntries = useAppStore((state) => state.journalPageEntries)
  const journalPageStickers = useAppStore((state) => state.journalPageStickers)
  const journalCursor = useAppStore((state) => state.journalCursor)
  const journalLoadStatus = useAppStore((state) => state.journalLoadStatus)
  const journalErrorMessage = useAppStore((state) => state.journalErrorMessage)
  const journalTurnDirection = useAppStore((state) => state.journalTurnDirection)
  const journalTurnPhase = useAppStore((state) => state.journalTurnPhase)
  const journalPendingCursor = useAppStore((state) => state.journalPendingCursor)
  const loadStatus = useAppStore((state) => state.loadStatus)
  const saveStatus = useAppStore((state) => state.saveStatus)
  const errorMessage = useAppStore((state) => state.errorMessage)
  const stickerErrorMessage = useAppStore((state) => state.stickerErrorMessage)
  const stickerWorkflow = useAppStore((state) => state.stickerWorkflow)
  const requestNotebookClose = useAppStore((state) => state.requestNotebookClose)
  const saveEntry = useAppStore((state) => state.saveEntry)
  const resetSaveStatus = useAppStore((state) => state.resetSaveStatus)
  const loadJournalPages = useAppStore((state) => state.loadJournalPages)
  const requestJournalTurn = useAppStore((state) => state.requestJournalTurn)
  const settleJournalTurn = useAppStore((state) => state.settleJournalTurn)
  const [draft, setDraft] = useState(initialDraft)

  useEffect(() => {
    void loadJournalPages()
  }, [loadJournalPages])

  const rightDate = journalPageDates[journalCursor] ?? selectedDate
  const leftDate = journalCursor > 0 ? journalPageDates[journalCursor - 1] ?? null : null
  const turning = journalTurnPhase !== 'idle'
  const placingSticker = stickerWorkflow === 'placingJournal'
  const overLimit = draft.length > MAX_ENTRY_LENGTH
  const saving = saveStatus === 'saving'

  const entryFor = (date: LocalDate) =>
    date === selectedDate ? entry : journalPageEntries[date] ?? null
  const stickersFor = (date: LocalDate): PlacedSticker[] =>
    date === selectedDate ? journalStickers : journalPageStickers[date] ?? []
  const navigate = (direction: JournalTurnDirection) => {
    void requestJournalTurn(direction)
  }

  const pendingDate = journalPendingCursor === null
    ? null
    : journalPageDates[journalPendingCursor] ?? null
  const turnFromDate = journalTurnDirection === 'previous' ? leftDate : rightDate

  return (
    <aside
      className="journal-panel"
      role="dialog"
      aria-labelledby="journal-title"
      aria-describedby="journal-navigation-help"
      data-turn-phase={journalTurnPhase}
      data-turn-direction={journalTurnDirection ?? 'none'}
    >
      <h1 id="journal-title" className="sr-only">双页日记本</h1>
      <p id="journal-navigation-help" className="sr-only">
        点击左页查看上一页，点击右页查看下一页。
      </p>
      <button
        className="icon-button journal-close-button"
        type="button"
        onClick={requestNotebookClose}
        aria-label="关闭本子"
        title="关闭本子"
        disabled={turning}
      >
        <X aria-hidden="true" size={20} strokeWidth={1.8} />
      </button>

      <div className="journal-book" aria-busy={journalLoadStatus === 'loading'}>
        {leftDate ? (
          <HistoricalJournalPage
            date={leftDate}
            direction="previous"
            disabled={turning}
            entry={entryFor(leftDate)}
            onNavigate={navigate}
            side="left"
            stickers={stickersFor(leftDate)}
          />
        ) : (
          <InsideCoverPage />
        )}

        <div className="journal-spine" aria-hidden="true" />

        {rightDate === selectedDate ? (
          <JournalPageFrame date={selectedDate} side="right" className="is-today">
            <form
              className="journal-form today-journal-form"
              onSubmit={async (event) => {
                event.preventDefault()
                await saveEntry(draft)
              }}
            >
              <header className="journal-page-head today-page-head">
                <div>
                  <p id="journal-date" className="journal-date">
                    {formatLocalDate(selectedDate)}
                  </p>
                  <h2>今天</h2>
                </div>
                <span className="journal-page-boundary">最后一页</span>
              </header>

              <div className="journal-paper">
                <label className="sr-only" htmlFor="daily-entry">
                  今天的记录
                </label>
                <textarea
                  autoFocus={!placingSticker}
                  id="daily-entry"
                  value={draft}
                  onChange={(event) => {
                    setDraft(event.target.value)
                    if (saveStatus !== 'idle') resetSaveStatus()
                  }}
                  maxLength={MAX_ENTRY_LENGTH + 1}
                  placeholder={loadStatus === 'loading' ? '正在打开...' : '写下一句话'}
                  disabled={loadStatus === 'loading' || placingSticker}
                />
                <JournalStickerLayer />
              </div>

              <div className="journal-meta">
                <span className={overLimit ? 'character-count over-limit' : 'character-count'}>
                  {draft.length} / {MAX_ENTRY_LENGTH}
                </span>
                <span className="save-message" role="status" aria-live="polite">
                  {saveStatus === 'saved' ? '已存入本地' : ''}
                </span>
              </div>

              {errorMessage || stickerErrorMessage ? (
                <p className="journal-error" role="alert">
                  {errorMessage || stickerErrorMessage}
                </p>
              ) : null}

              <div className="journal-actions">
                <button
                  className="save-button"
                  type="submit"
                  disabled={saving || !draft.trim() || overLimit || loadStatus === 'loading' || placingSticker}
                >
                  <Save aria-hidden="true" size={18} strokeWidth={1.8} />
                  <span>{saving ? '保存中' : '保存'}</span>
                </button>
              </div>
            </form>
          </JournalPageFrame>
        ) : (
          <HistoricalJournalPage
            date={rightDate}
            direction="next"
            disabled={turning}
            entry={entryFor(rightDate)}
            onNavigate={navigate}
            side="right"
            stickers={stickersFor(rightDate)}
          />
        )}

        {journalTurnPhase === 'turning' && journalTurnDirection && turnFromDate && pendingDate ? (
          <PageTurnSheet
            direction={journalTurnDirection}
            fromDate={turnFromDate}
            toDate={pendingDate}
            onComplete={settleJournalTurn}
          />
        ) : null}
      </div>

      <div className="journal-turn-status" role="status" aria-live="polite">
        {journalLoadStatus === 'loading'
          ? '正在整理日记页…'
          : journalTurnPhase === 'loading'
            ? '正在读取这一页…'
            : journalErrorMessage ?? ''}
      </div>
    </aside>
  )
}
