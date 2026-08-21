import { Check, PenLine, Save, Type, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import {
  entryTitle,
  formatLocalDate,
  MAX_ENTRY_LENGTH,
  MAX_ENTRY_TITLE_LENGTH,
  type LocalDate,
} from '../../domain/daily-entry'
import {
  JOURNAL_FONT_OPTIONS,
  readJournalFontPreference,
  writeJournalFontPreference,
  type JournalFontId,
} from '../../domain/journal-font'
import type { PlacedSticker } from '../../domain/sticker'
import type { JournalTurnDirection } from '../../state/app-store'
import { useAppStore } from '../../state/app-store-context'
import { Button, IconButton, SegmentedControl } from '../../ui'
import {
  JournalPageFrame,
  JournalNavigationControls,
  JournalReadingPage,
  JournalStickerPage,
} from './JournalPage'
import { PageTurnSheet } from './PageTurnSheet'

type JournalMode = 'reading' | 'editing'
type WritingPhase = 'idle' | 'writing' | 'saving'

const availableJournalFonts = JOURNAL_FONT_OPTIONS.filter((option) =>
  import.meta.env.DEV || option.id !== 'jingjing')
const availableJournalFontIds = availableJournalFonts.map((option) => option.id)

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
  const openStickerStudioFromJournal = useAppStore(
    (state) => state.openStickerStudioFromJournal,
  )
  const saveJournalEntry = useAppStore((state) => state.saveJournalEntry)
  const resetSaveStatus = useAppStore((state) => state.resetSaveStatus)
  const loadJournalPages = useAppStore((state) => state.loadJournalPages)
  const requestJournalTurn = useAppStore((state) => state.requestJournalTurn)
  const settleJournalTurn = useAppStore((state) => state.settleJournalTurn)
  const [journalMode, setJournalMode] = useState<JournalMode>('reading')
  const [writingPhase, setWritingPhase] = useState<WritingPhase>('idle')
  const [draftDate, setDraftDate] = useState<LocalDate | null>(null)
  const [draft, setDraft] = useState('')
  const [draftTitle, setDraftTitle] = useState('')
  const [sessionMessage, setSessionMessage] = useState('')
  const [journalFont, setJournalFont] = useState<JournalFontId>(() =>
    readJournalFontPreference(window.localStorage, availableJournalFontIds))
  const [fontMenuOpen, setFontMenuOpen] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fontControlRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    void loadJournalPages()
  }, [loadJournalPages])

  useEffect(() => {
    if (writingPhase === 'writing') textareaRef.current?.focus()
  }, [writingPhase])

  useEffect(() => {
    if (!import.meta.env.DEV) return

    const style = document.createElement('style')
    style.dataset.dearDeskDevelopmentFont = 'jingjing'
    style.textContent = '@font-face{font-family:"Dear Desk JingJing";src:url("/dev-fonts/YunFengJingJingTi-Regular.ttf") format("truetype");font-display:swap;font-style:normal;font-weight:400;}'
    document.head.append(style)
    return () => style.remove()
  }, [])

  useEffect(() => {
    if (!fontMenuOpen) return

    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (!fontControlRef.current?.contains(event.target as Node)) {
        setFontMenuOpen(false)
      }
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setFontMenuOpen(false)
    }

    document.addEventListener('pointerdown', closeOnOutsidePointer)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsidePointer)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [fontMenuOpen])

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
    journalPageStickers[date] ?? (date === selectedDate ? journalStickers : [])

  const currentEntry = entryFor(rightDate)
  const currentText = currentEntry?.text ?? ''
  const currentTitle = entryTitle(currentEntry, rightDate === selectedDate)
  const activeDraft = draftDate === rightDate ? draft : currentText
  const activeTitle = draftDate === rightDate ? draftTitle : currentTitle
  const dirty = writingPhase === 'writing' &&
    (activeDraft !== currentText || activeTitle !== currentTitle)
  const overLimit = activeDraft.length > MAX_ENTRY_LENGTH
  const titleOverLimit = activeTitle.length > MAX_ENTRY_TITLE_LENGTH
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
    setSessionMessage('')
    resetSaveStatus()
    setJournalMode(mode)
    if (mode === 'reading') {
      setWritingPhase('idle')
      setDraftDate(null)
      setFontMenuOpen(false)
      return
    }

    if (pageUnavailable || placingSticker) return
    setDraftDate(rightDate)
    setDraft(currentText)
    setDraftTitle(currentTitle)
    setWritingPhase('writing')
  }

  const selectJournalFont = (fontId: JournalFontId) => {
    setJournalFont(fontId)
    writeJournalFontPreference(window.localStorage, fontId)
    setFontMenuOpen(false)
  }

  const startWriting = () => {
    if (pageUnavailable || placingSticker) return
    setDraftDate(rightDate)
    setDraft(currentText)
    setDraftTitle(currentTitle)
    setWritingPhase('writing')
    setSessionMessage('')
    resetSaveStatus()
  }

  const saveDraft = async () => {
    if (writingPhase !== 'writing' || draftDate !== rightDate) return
    setWritingPhase('saving')
    setSessionMessage('')
    const saved = await saveJournalEntry(draftDate, draft, draftTitle)
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

  const openStickerWorkbench = () => {
    if (dirty) {
      setSessionMessage('请先收笔，再前往贴纸工作台。')
      return
    }
    if (turning || saving || placingSticker) return
    setSessionMessage('')
    openStickerStudioFromJournal()
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
      data-journal-font={journalFont}
    >
      <h1 id="journal-title" className="sr-only">双页日记本</h1>
      <p id="journal-navigation-help" className="sr-only">
        左页展示当前日期贴纸，右页显示正文；使用本子下方的按钮翻页。
      </p>
      <IconButton
        className="icon-button journal-close-button"
        onClick={closeNotebook}
        aria-disabled={dirty || saving || undefined}
        label="关闭本子"
        disabled={turning}
        variant="quiet"
      >
        <X aria-hidden="true" size={20} strokeWidth={1.8} />
      </IconButton>

      <div className="journal-book-stage">
        <div className="journal-book" aria-busy={journalLoadStatus === 'loading'}>
        <JournalStickerPage
          blocked={saving || placingSticker}
          date={rightDate}
          disabled={pageUnavailable}
          interactive={rightDate === selectedDate}
          onOpenWorkbench={openStickerWorkbench}
          stickers={stickersFor(rightDate)}
        />

        <div className="journal-spine" aria-hidden="true" />

        {writing ? (
          <JournalPageFrame date={rightDate} side="right" className="is-current-page is-writing">
            <form
              id="journal-entry-form"
              className="journal-form"
              autoComplete="off"
              onSubmit={(event) => {
                event.preventDefault()
                void saveDraft()
              }}
            >
              <header className="journal-page-head">
                <div>
                  <p className="journal-date">{formatLocalDate(rightDate)}</p>
                  <label className="sr-only" htmlFor="journal-entry-title">
                    日记标题
                  </label>
                  <input
                    id="journal-entry-title"
                    className="journal-title-input"
                    autoCapitalize="none"
                    autoComplete="off"
                    autoCorrect="off"
                    value={activeTitle}
                    onChange={(event) => {
                      setDraftTitle(event.target.value)
                      if (saveStatus !== 'idle') resetSaveStatus()
                      if (sessionMessage) setSessionMessage('')
                    }}
                    maxLength={MAX_ENTRY_TITLE_LENGTH + 1}
                    name="journal-title"
                    spellCheck={false}
                    disabled={saving || placingSticker}
                  />
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
              </div>

              <div className="journal-meta">
                <span className={overLimit || titleOverLimit ? 'character-count over-limit' : 'character-count'}>
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
            entry={currentEntry}
            isToday={rightDate === selectedDate}
          />
        )}

        {journalTurnPhase === 'turning' && journalTurnDirection && pendingDate ? (
          <PageTurnSheet
            direction={journalTurnDirection}
            onComplete={settleJournalTurn}
          />
        ) : null}
        </div>

      </div>

      <JournalNavigationControls
        blocked={writing}
        currentDate={rightDate}
        disabled={pageUnavailable}
        nextDate={nextDate}
        onNavigate={navigate}
        previousDate={previousDate}
      />

      <div className="journal-mode-controls" aria-label="日记模式与书写动作">
        <SegmentedControl
          className="journal-mode-toggle"
          ariaLabel={journalMode === 'reading'
            ? '当前为阅读模式，切换到编辑模式'
            : '当前为编辑模式，切换到阅读模式'}
          disabled={placingSticker}
          onChange={selectMode}
          options={[
            { label: '阅读', value: 'reading' },
            { label: '编辑', value: 'editing' },
          ]}
          value={journalMode}
        />
        {journalMode === 'editing' ? (
          <>
            <Button
              className="journal-writing-button"
              htmlType="button"
              icon={writing ? <Save aria-hidden="true" size={17} /> : <PenLine aria-hidden="true" size={17} />}
              onClick={writing ? () => void saveDraft() : startWriting}
              aria-pressed={writing}
              aria-label={writing ? '保存本页' : '开始书写本页'}
              title={writing ? '保存本页' : '开始书写本页'}
              disabled={saving || overLimit || titleOverLimit || (writing && (!activeDraft.trim() || !activeTitle.trim())) || (!writing && (pageUnavailable || placingSticker))}
              loading={saving}
              variant="primary"
            >
              <span>{saving ? '收笔中' : writing ? '收笔' : '书写'}</span>
            </Button>
            <div className="journal-font-control" ref={fontControlRef}>
              <IconButton
                className="journal-font-button"
                label={`更换字体，当前${availableJournalFonts.find((option) => option.id === journalFont)?.label ?? '纸页宋体'}`}
                aria-expanded={fontMenuOpen}
                aria-haspopup="menu"
                onClick={() => setFontMenuOpen((open) => !open)}
                variant="secondary"
              >
                <Type aria-hidden="true" size={21} strokeWidth={2} />
              </IconButton>
              {fontMenuOpen ? (
                <div className="journal-font-menu" role="menu" aria-label="选择日记字体">
                  {availableJournalFonts.map((option) => (
                    <button
                      className="journal-font-option"
                      data-font-preview={option.id}
                      key={option.id}
                      onClick={() => selectJournalFont(option.id)}
                      role="menuitemradio"
                      aria-checked={journalFont === option.id}
                      type="button"
                    >
                      <span className="journal-font-option__sample" aria-hidden="true">
                        {option.sample}
                      </span>
                      <span>{option.label}</span>
                      {journalFont === option.id ? <Check aria-hidden="true" size={16} /> : null}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          </>
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
