import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { ReactNode } from 'react'

import { formatLocalDate, type DailyEntry, type LocalDate } from '../../domain/daily-entry'
import type { PlacedSticker } from '../../domain/sticker'
import type { JournalTurnDirection } from '../../state/app-store'
import { JournalStickerLayer } from './JournalStickerLayer'

interface JournalPageFrameProps {
  children: ReactNode
  className?: string
  date: LocalDate | null
  side: 'left' | 'right'
}

export function JournalPageFrame({
  children,
  className = '',
  date,
  side,
}: JournalPageFrameProps) {
  return (
    <section
      className={`journal-page journal-page-${side} ${className}`.trim()}
      data-page-date={date ?? 'inside-cover'}
    >
      {children}
    </section>
  )
}

interface HistoricalJournalPageProps {
  date: LocalDate
  direction: JournalTurnDirection
  disabled: boolean
  entry: DailyEntry | null
  onNavigate: (direction: JournalTurnDirection) => void
  side: 'left' | 'right'
  stickers: PlacedSticker[]
}

export function HistoricalJournalPage({
  date,
  direction,
  disabled,
  entry,
  onNavigate,
  side,
  stickers,
}: HistoricalJournalPageProps) {
  const label = direction === 'previous' ? '上一页' : '下一页'
  const Icon = direction === 'previous' ? ChevronLeft : ChevronRight

  return (
    <JournalPageFrame date={date} side={side} className="is-historical">
      <button
        className="journal-page-navigation"
        type="button"
        aria-label={`${label}，${formatLocalDate(date)}`}
        disabled={disabled}
        onClick={() => onNavigate(direction)}
      />
      <div className="journal-page-body">
        <header className="journal-page-head">
          <p>{formatLocalDate(date)}</p>
          <span>{label}</span>
        </header>
        <div className="journal-page-copy">
          {entry?.text ? (
            <p>{entry.text}</p>
          ) : stickers.length > 0 ? (
            <p className="journal-page-empty">这一天只留下了贴纸。</p>
          ) : (
            <p className="journal-page-empty">这一页是空白的。</p>
          )}
          <JournalStickerLayer stickers={stickers} interactive={false} />
        </div>
        <footer className="journal-page-foot">
          <Icon aria-hidden="true" size={15} />
          <span>点击{side === 'left' ? '左' : '右'}页 · {label}</span>
        </footer>
      </div>
    </JournalPageFrame>
  )
}

export function InsideCoverPage() {
  return (
    <JournalPageFrame date={null} side="left" className="is-inside-cover">
      <div className="journal-page-body">
        <div className="journal-inside-cover-mark" aria-hidden="true">DD</div>
        <p>这是本子的第一页</p>
      </div>
    </JournalPageFrame>
  )
}
