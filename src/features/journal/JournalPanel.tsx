import { PenLine, Save, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import { formatLocalDate, MAX_ENTRY_LENGTH, type LocalDate } from '../../domain/daily-entry'
import type { PlacedSticker } from '../../domain/sticker'
import type { JournalTurnDirection } from '../../state/app-store'
import { useAppStore } from '../../state/app-store-context'
import {
  BlankJournalPage,
  JournalPageFrame,
  JournalReadingPage,
} from './JournalPage'
import { JournalStickerLayer } from './JournalStickerLayer'
import { PageTurnSheet } from './PageTurnSheet'

type JournalMode = 'reading' | 'editing'
type WritingPhase = 'idle' | 'writing' | 'saving'

export function JournalPanel() {
  const notebookPhase = useAppStore((state) => state.notebookPhase)

  if (notebookPhase !== 'editing') return null

  return <JournalBook />
}

function JournalBook() {
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
  const saveJournalEntry = useAppStore((state) => state.saveJournalEntry)
  const resetSaveStatus = useAppStore((state) => state.resetSaveStatus)
  const loadJournalPages = useAppStore((state) => state.loadJournalPages)
  const requestJournalTurn = useAppStore((state) => state.requestJournalTurn)
  const settleJournalTurn = useAppStore((state) => state.settleJournalTurn)
  const [journalMode, setJournalMode] = useState<JournalMode>('reading')
  const [writingPhase, setWritingPhase] = useState<WritingPhase>('idle')
  const [draftDate, setDraftDate] = useState<LocalDate | null>(null)
  const [draft, setDraft] = useState('')
  const [sessionMessage, setSessionMessage] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    void loadJournalPages()
  }, [loadJournalPages])

  useEffect(() => {
    if (writingPhase === 'writing') textareaRef.current?.focus()
  }, [writingPhase])

  const rightDate = journalPageDates[journalCursor] ?? selectedDate
  const previousDate = journalCursor > 0
    ? journalPageDates[journalCursor - 1] ?? null
    : null
  const nextDate = journalCursor < journalPageDates.length - 1
    ? journalPageDates[journalCursor + 1] ?? null
    : null
  const turning = journalTurnPhase !== 'idle'
  const placingSticker = stickerWorkflow === 'placingJournal'
  const writing = writingPhase !== 'idle'
  const saving = writingPhase === 'saving'

  const entryFor = (date: LocalDate) =>
    date === selectedDate ? entry ?? journalPageEntries[date] ?? null : journalPageEntries[date] ?? null
  const stickersFor = (date: LocalDate): PlacedSticker[] =>
    date === selectedDate ? journalStickers : journalPageStickers[date] ?? []

  const currentEntry = entryFor(rightDate)
  const currentText = currentEntry?.text ?? ''
  const activeDraft = draftDate === rightDate ? draft : currentText
  const dirty = writingPhase === 'writing' && activeDraft !== currentText
  const overLimit = activeDraft.length > MAX_ENTRY_LENGTH
  const pageUnavailable = journalLoadStatus !== 'ready' || turning

  const guardLeavingWriting = (message: string) => {
    if (!writing) return false
    setSessionMessage(message)
    return true
  }

  const navigate = (direction: JournalTurnDirection) => {
    if (guardLeavingWriting('请先收笔，再翻页。')) return
    setSessionMessage('')
    resetSaveStatus()
    void requestJournalTurn(direction)
  }

  const selectMode = (mode: JournalMode) => {
    if (mode === journalMode) return
    if (mode === 'reading' && dirty) {
      setSessionMessage('请先收笔，再切回阅读。')
      return
    }
    if (saving || placingSticker) return
    setWritingPhase('idle')
    setDraftDate(null)
    setSessionMessage('')
    resetSaveStatus()
    setJournalMode(mode)
  }

  const startWriting = () => {
    if (pageUnavailable || placingSticker) return
    setDraftDate(rightDate)
    setDraft(currentText)
    setWritingPhase('writing')
    setSessionMessage('')
    resetSaveStatus()
  }

  const saveDraft = async () => {
    if (writingPhase !== 'writing' || draftDate !== rightDate) return
    setWritingPhase('saving')
    setSessionMessage('')
    const saved = await saveJournalEntry(draftDate, draft)
    if (saved) {
      setWritingPhase('idle')
      setDraftDate(null)
      setSessionMessage('已收笔，内容已存入本地。')
    } else {
      setWritingPhase('writing')
    }
  }

  const closeNotebook = () => {
    if (saving) return
    if (dirty) {
      setSessionMessage('请先收笔，再关闭本子。')
      return
    }
    requestNotebookClose()
  }

  const pendingDate = journalPendingCursor === null
    ? null
    : journalPageDates[journalPendingCursor] ?? null

  return (
    <aside
      className="journal-panel"
      role="dialog"
      aria-labelledby="journal-title"
      aria-describedby="journal-navigation-help"
      data-journal-mode={journalMode}
      data-writing-phase={writingPhase}
      data-turn-phase={journalTurnPhase}
      data-turn-direction={journalTurnDirection ?? 'none'}
    >
      <h1 id="journal-title" className="sr-only">双页日记本</h1>
      <p id="journal-navigation-help" className="sr-only">
        左页留白并用于返回上一页，当前日期的内容只显示在右页。
      </p>
      <button
        className="icon-button journal-close-button"
        type="button"
        onClick={closeNotebook}
        aria-disabled={dirty || saving || undefined}
        aria-label="关闭本子"
        title="关闭本子"
        disabled={turning}
      >
        <X aria-hidden="true" size={20} strokeWidth={1.8} />
      </button>

      <div className="journal-book-stage">
        <div className="journal-book" aria-busy={journalLoadStatus === 'loading'}>
        <BlankJournalPage
          blocked={writing}
          disabled={pageUnavailable}
          onNavigate={navigate}
          previousDate={previousDate}
        />

        <div className="journal-spine" aria-hidden="true" />

        {writing ? (
          <JournalPageFrame date={rightDate} side="right" className="is-current-page is-writing">
            <form
              id="journal-entry-form"
              className="journal-form"
              onSubmit={(event) => {
                event.preventDefault()
                void saveDraft()
              }}
            >
              <header className="journal-page-head">
                <div>
                  <p className="journal-date">{formatLocalDate(rightDate)}</p>
                  <h2>{rightDate === selectedDate ? '今天' : '日记'}</h2>
                </div>
                <span>{saving ? '正在收笔' : '正在书写'}</span>
              </header>

              <div className="journal-paper">
                <label className="sr-only" htmlFor="journal-entry-textarea">
                  本页记录
                </label>
                <textarea
                  ref={textareaRef}
                  id="journal-entry-textarea"
                  value={activeDraft}
                  onChange={(event) => {
                    setDraft(event.target.value)
                    if (saveStatus !== 'idle') resetSaveStatus()
                    if (sessionMessage) setSessionMessage('')
                  }}
                  maxLength={MAX_ENTRY_LENGTH + 1}
                  placeholder={loadStatus === 'loading' ? '正在打开...' : '写下一句话'}
                  disabled={saving || placingSticker}
                />
                <JournalStickerLayer
                  stickers={stickersFor(rightDate)}
                  interactive={rightDate === selectedDate}
                />
              </div>

              <div className="journal-meta">
                <span className={overLimit ? 'character-count over-limit' : 'character-count'}>
                  {activeDraft.length} / {MAX_ENTRY_LENGTH}
                </span>
                <span className="save-message" aria-live="polite">
                  {saveStatus === 'saved' ? '已存入本地' : ''}
                </span>
              </div>

              {errorMessage || stickerErrorMessage ? (
                <p className="journal-error" role="alert">
                  {errorMessage || stickerErrorMessage}
                </p>
              ) : null}
            </form>
          </JournalPageFrame>
        ) : (
          <JournalReadingPage
            date={rightDate}
            disabled={pageUnavailable}
            entry={currentEntry}
            interactiveStickers={rightDate === selectedDate}
            isToday={rightDate === selectedDate}
            nextDate={nextDate}
            onNavigate={navigate}
            stickers={stickersFor(rightDate)}
          />
        )}

        {journalTurnPhase === 'turning' && journalTurnDirection && pendingDate ? (
          <PageTurnSheet
            direction={journalTurnDirection}
            fromDate={rightDate}
            toDate={pendingDate}
            onComplete={settleJournalTurn}
          />
        ) : null}
        </div>

        <div className="journal-bookmark" aria-hidden="true" />
      </div>

      <div className="journal-mode-controls" aria-label="日记模式与书写动作">
        <button
          className="journal-mode-toggle"
          type="button"
          data-mode={journalMode}
          aria-pressed={journalMode === 'editing'}
          aria-disabled={dirty || saving || undefined}
          aria-label={journalMode === 'reading'
            ? '当前为阅读模式，切换到编辑模式'
            : '当前为编辑模式，切换到阅读模式'}
          title={journalMode === 'reading' ? '切换到编辑模式' : '切换到阅读模式'}
          disabled={placingSticker}
          onClick={() => selectMode(journalMode === 'reading' ? 'editing' : 'reading')}
        >
          <span className="journal-mode-label is-reading" aria-hidden="true">阅读</span>
          <span className="journal-mode-label is-editing" aria-hidden="true">编辑</span>
        </button>
        {journalMode === 'editing' ? (
          <button
            className="journal-writing-button"
            type={writing ? 'submit' : 'button'}
            form={writing ? 'journal-entry-form' : undefined}
            onClick={writing ? undefined : startWriting}
            aria-pressed={writing}
            aria-label={writing ? '保存本页' : '开始书写本页'}
            title={writing ? '保存本页' : '开始书写本页'}
            disabled={saving || overLimit || (writing && !activeDraft.trim()) || (!writing && (pageUnavailable || placingSticker))}
          >
            {writing ? <Save aria-hidden="true" size={17} /> : <PenLine aria-hidden="true" size={17} />}
            <span>{saving ? '收笔中' : writing ? '收笔' : '书写'}</span>
          </button>
        ) : null}
      </div>

      <div className="journal-turn-status" role="status" aria-live="polite">
        {sessionMessage || (journalLoadStatus === 'loading'
          ? '正在整理日记页…'
          : journalTurnPhase === 'loading'
            ? '正在读取这一页…'
            : journalErrorMessage ?? '')}
      </div>
    </aside>
  )
}
