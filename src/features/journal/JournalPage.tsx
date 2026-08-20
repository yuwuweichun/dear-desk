import { ChevronRight } from 'lucide-react'
import type { ReactNode } from 'react'

import {
  entryTitle,
  formatLocalDate,
  type DailyEntry,
  type LocalDate,
} from '../../domain/daily-entry'
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
      data-page-date={date ?? 'blank'}
    >
      {children}
    </section>
  )
}

interface JournalPageNavigationProps {
  blocked: boolean
  date: LocalDate
  direction: JournalTurnDirection
  disabled: boolean
  onNavigate: (direction: JournalTurnDirection) => void
}

function JournalPageNavigation({
  blocked,
  date,
  direction,
  disabled,
  onNavigate,
}: JournalPageNavigationProps) {
  const label = direction === 'previous' ? '上一页' : '下一页'

  return (
    <button
      className={`journal-page-navigation is-${direction}`}
      type="button"
      aria-disabled={blocked || undefined}
      aria-label={`${label}，${formatLocalDate(date)}`}
      disabled={disabled}
      onClick={() => onNavigate(direction)}
    />
  )
}

interface BlankJournalPageProps {
  blocked: boolean
  disabled: boolean
  onNavigate: (direction: JournalTurnDirection) => void
  previousDate: LocalDate | null
}

export function BlankJournalPage({
  blocked,
  disabled,
  onNavigate,
  previousDate,
}: BlankJournalPageProps) {
  return (
    <JournalPageFrame date={null} side="left" className="is-blank-page">
      {previousDate ? (
        <JournalPageNavigation
          blocked={blocked}
          date={previousDate}
          direction="previous"
          disabled={disabled}
          onNavigate={onNavigate}
        />
      ) : null}
    </JournalPageFrame>
  )
}

interface JournalReadingPageProps {
  date: LocalDate
  disabled: boolean
  entry: DailyEntry | null
  interactiveStickers: boolean
  isToday: boolean
  nextDate: LocalDate | null
  onNavigate: (direction: JournalTurnDirection) => void
  stickers: PlacedSticker[]
}

export function JournalReadingPage({
  date,
  disabled,
  entry,
  interactiveStickers,
  isToday,
  nextDate,
  onNavigate,
  stickers,
}: JournalReadingPageProps) {
  return (
    <JournalPageFrame date={date} side="right" className="is-current-page">
      {nextDate ? (
        <JournalPageNavigation
          blocked={false}
          date={nextDate}
          direction="next"
          disabled={disabled}
          onNavigate={onNavigate}
        />
      ) : null}
      <div className="journal-page-body">
        <header className="journal-page-head">
          <div>
            <p className="journal-date">{formatLocalDate(date)}</p>
            <h2>{entryTitle(entry, isToday)}</h2>
          </div>
          <span>{isToday ? '当前日期' : '旧日记录'}</span>
        </header>
        <div className="journal-page-copy">
          {entry?.text ? (
            <p>{entry.text}</p>
          ) : stickers.length > 0 ? (
            <p className="journal-page-empty">这一天只留下了贴纸。</p>
          ) : (
            <p className="journal-page-empty">这一页是空白的。</p>
          )}
          <JournalStickerLayer
            stickers={stickers}
            interactive={interactiveStickers}
          />
        </div>
        {nextDate ? (
          <footer className="journal-page-foot">
            <span>右页边缘 · 下一页</span>
            <ChevronRight aria-hidden="true" size={15} />
          </footer>
        ) : null}
      </div>
    </JournalPageFrame>
  )
}
