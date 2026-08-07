import { Save, Sticker, X } from 'lucide-react'
import { useState } from 'react'

import { formatLocalDate, MAX_ENTRY_LENGTH } from '../../domain/daily-entry'
import { MAX_STICKER_TEXT_LENGTH } from '../../domain/sticker'
import { useAppStore } from '../../state/app-store-context'

export function JournalPanel() {
  const notebookPhase = useAppStore((state) => state.notebookPhase)
  const selectedDate = useAppStore((state) => state.selectedDate)
  const entry = useAppStore((state) => state.entry)
  const stickerDraftText = useAppStore((state) => state.stickerDraftText)

  if (notebookPhase !== 'editing') return null

  return (
    <JournalEditor
      key={`${selectedDate}-${entry?.updatedAt ?? 'empty'}-${stickerDraftText ?? 'stored'}`}
      initialDraft={stickerDraftText ?? entry?.text ?? ''}
    />
  )
}

interface JournalEditorProps {
  initialDraft: string
}

function JournalEditor({ initialDraft }: JournalEditorProps) {
  const selectedDate = useAppStore((state) => state.selectedDate)
  const loadStatus = useAppStore((state) => state.loadStatus)
  const saveStatus = useAppStore((state) => state.saveStatus)
  const errorMessage = useAppStore((state) => state.errorMessage)
  const requestNotebookClose = useAppStore((state) => state.requestNotebookClose)
  const saveEntry = useAppStore((state) => state.saveEntry)
  const resetSaveStatus = useAppStore((state) => state.resetSaveStatus)
  const startStickerComposer = useAppStore(
    (state) => state.startStickerComposer,
  )
  const stickerErrorMessage = useAppStore(
    (state) => state.stickerErrorMessage,
  )
  const [draft, setDraft] = useState(initialDraft)

  const overLimit = draft.length > MAX_ENTRY_LENGTH
  const saving = saveStatus === 'saving'

  return (
    <aside
      className="journal-panel"
      role="dialog"
      aria-labelledby="journal-title"
      aria-describedby="journal-date"
    >
      <header className="journal-head">
        <div>
          <p id="journal-date" className="journal-date">
            {formatLocalDate(selectedDate)}
          </p>
          <h1 id="journal-title">今天</h1>
        </div>
        <button
          className="icon-button"
          type="button"
          onClick={requestNotebookClose}
          aria-label="关闭本子"
          title="关闭本子"
        >
          <X aria-hidden="true" size={20} strokeWidth={1.8} />
        </button>
      </header>

      <form
        className="journal-form"
        onSubmit={async (event) => {
          event.preventDefault()
          await saveEntry(draft)
        }}
      >
        <label className="sr-only" htmlFor="daily-entry">
          今天的记录
        </label>
        <textarea
          autoFocus
          id="daily-entry"
          value={draft}
          onChange={(event) => {
            setDraft(event.target.value)
            if (saveStatus !== 'idle') resetSaveStatus()
          }}
          maxLength={MAX_ENTRY_LENGTH + 1}
          placeholder={loadStatus === 'loading' ? '正在打开...' : '写下一句话'}
          disabled={loadStatus === 'loading'}
        />

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
            className="sticker-button"
            type="button"
            onClick={() => startStickerComposer(draft)}
            disabled={
              !draft.trim() ||
              draft.trim().length > MAX_STICKER_TEXT_LENGTH ||
              loadStatus === 'loading'
            }
            title={`制作贴纸，最多 ${MAX_STICKER_TEXT_LENGTH} 个字符`}
          >
            <Sticker aria-hidden="true" size={18} strokeWidth={1.8} />
            <span>制作贴纸</span>
          </button>
          <button
            className="save-button"
            type="submit"
            disabled={saving || !draft.trim() || overLimit || loadStatus === 'loading'}
          >
            <Save aria-hidden="true" size={18} strokeWidth={1.8} />
            <span>{saving ? '保存中' : '保存'}</span>
          </button>
        </div>
      </form>
    </aside>
  )
}
