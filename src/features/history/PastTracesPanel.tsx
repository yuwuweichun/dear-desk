import { Archive, CalendarDays, RefreshCw, Sticker, X } from 'lucide-react'
import { useEffect, useMemo, useRef } from 'react'

import { formatLocalDate } from '../../domain/daily-entry'
import {
  formatPastTraceMonth,
  pastTraceMonthKey,
  type PastTraceSummary,
} from '../../domain/past-trace'
import { useAppStore } from '../../state/app-store-context'
import { Button, IconButton } from '../../ui'

const groupByMonth = (traces: readonly PastTraceSummary[]) => {
  const groups = new Map<string, PastTraceSummary[]>()
  for (const trace of traces) {
    const key = pastTraceMonthKey(trace.date)
    groups.set(key, [...(groups.get(key) ?? []), trace])
  }
  return [...groups]
}

export function PastTracesPanel() {
  const phase = useAppStore((state) => state.pastTracesPhase)
  const status = useAppStore((state) => state.pastTracesStatus)
  const traces = useAppStore((state) => state.pastTraces)
  const errorMessage = useAppStore((state) => state.pastTracesErrorMessage)
  const loadPastTraces = useAppStore((state) => state.loadPastTraces)
  const requestClose = useAppStore((state) => state.requestPastTracesClose)
  const selectPastTrace = useAppStore((state) => state.selectPastTrace)
  const panelRef = useRef<HTMLElement>(null)
  const monthGroups = useMemo(() => groupByMonth(traces), [traces])

  useEffect(() => {
    if (phase !== 'open') return
    panelRef.current?.querySelector<HTMLButtonElement>('button')?.focus()
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') requestClose()
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [phase, requestClose])

  if (phase !== 'open') return null

  return (
    <div
      className="past-traces-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) requestClose()
      }}
    >
      <aside
        aria-labelledby="past-traces-title"
        aria-modal="true"
        className="past-traces-panel"
        ref={panelRef}
        role="dialog"
      >
        <header className="past-traces-header">
          <div className="past-traces-heading">
            <Archive aria-hidden="true" size={22} strokeWidth={1.8} />
            <div>
              <p>ARCHIVE DRAWER</p>
              <h2 id="past-traces-title">旧痕迹</h2>
            </div>
          </div>
          <IconButton
            label="关闭旧痕迹"
            onClick={requestClose}
            variant="quiet"
          >
            <X aria-hidden="true" size={19} />
          </IconButton>
        </header>

        <div className="past-traces-content">
          {status === 'loading' || status === 'idle' ? (
            <div className="past-traces-message" role="status">
              <Archive aria-hidden="true" size={26} strokeWidth={1.6} />
              <p>正在翻找旧痕迹...</p>
            </div>
          ) : null}

          {status === 'error' ? (
            <div className="past-traces-message" role="alert">
              <p>{errorMessage ?? '旧痕迹暂时无法读取。'}</p>
              <Button
                icon={<RefreshCw aria-hidden="true" size={17} />}
                onClick={() => void loadPastTraces()}
                variant="secondary"
              >
                再试一次
              </Button>
            </div>
          ) : null}

          {status === 'ready' && monthGroups.length === 0 ? (
            <div className="past-traces-message">
              <Archive aria-hidden="true" size={26} strokeWidth={1.6} />
              <p>还没有可以翻找的旧痕迹。</p>
            </div>
          ) : null}

          {status === 'ready' ? monthGroups.map(([month, items]) => (
            <section className="past-traces-month" key={month}>
              <h3>{formatPastTraceMonth(month)}</h3>
              <ol>
                {items.map((trace) => (
                  <li key={trace.date}>
                    <button
                      aria-label={`打开 ${trace.date} 的旧痕迹`}
                      className="past-trace-row"
                      onClick={() => selectPastTrace(trace.date)}
                      type="button"
                    >
                      <span className="past-trace-date">
                        <CalendarDays aria-hidden="true" size={17} strokeWidth={1.8} />
                        <time dateTime={trace.date}>{formatLocalDate(trace.date)}</time>
                      </span>
                      <span className="past-trace-copy">
                        <strong>{trace.title}</strong>
                        <span>
                          {trace.hasEntry ? trace.textPreview : '仅有贴纸'}
                        </span>
                      </span>
                      {trace.stickerCount > 0 ? (
                        <span
                          aria-label={`${trace.stickerCount} 张贴纸`}
                          className="past-trace-sticker-count"
                        >
                          <Sticker aria-hidden="true" size={15} />
                          {trace.stickerCount}
                        </span>
                      ) : null}
                    </button>
                  </li>
                ))}
              </ol>
            </section>
          )) : null}
        </div>
      </aside>
    </div>
  )
}
