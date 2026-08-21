import { Redo2, Sticker, Undo2 } from 'lucide-react'
import type { ReactNode } from 'react'

import {
  entryTitle,
  formatLocalDate,
  type DailyEntry,
  type LocalDate,
} from '../../domain/daily-entry'
import type { PlacedSticker } from '../../domain/sticker'
import type { JournalTurnDirection } from '../../state/app-store'
import { Button, IconButton } from '../../ui'
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

interface JournalStickerPageProps {
  blocked: boolean
  date: LocalDate
  disabled: boolean
  onOpenWorkbench: () => void
  stickers: PlacedSticker[]
  interactive: boolean
}

export function JournalStickerPage({
  blocked,
  date,
  disabled,
  onOpenWorkbench,
  stickers,
  interactive,
}: JournalStickerPageProps) {
  return (
    <JournalPageFrame date={date} side="left" className="is-sticker-page">
      <div className="journal-sticker-page-body">
        <header className="journal-page-head">
          <div>
            <p className="journal-date">{formatLocalDate(date)}</p>
            <h2>贴纸</h2>
          </div>
          <span>{stickers.length > 0 ? `${stickers.length} 张` : '尚未留下'}</span>
        </header>
        <div className="journal-sticker-paper">
          <JournalStickerLayer stickers={stickers} interactive={interactive} />
          {stickers.length === 0 ? (
            <p className="journal-sticker-empty">把今天的心情贴在这一页。</p>
          ) : null}
        </div>
        <Button
          className="journal-sticker-workbench-button"
          disabled={blocked || disabled}
          icon={<Sticker aria-hidden="true" size={17} strokeWidth={1.9} />}
          onClick={onOpenWorkbench}
          variant="secondary"
        >
          前往贴纸工作台
        </Button>
      </div>
    </JournalPageFrame>
  )
}

interface JournalReadingPageProps {
  date: LocalDate
  entry: DailyEntry | null
  isToday: boolean
}

export function JournalReadingPage({
  date,
  entry,
  isToday,
}: JournalReadingPageProps) {
  return (
    <JournalPageFrame date={date} side="right" className="is-current-page">
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
          ) : (
            <p className="journal-page-empty">这一页是空白的。</p>
          )}
        </div>
      </div>
    </JournalPageFrame>
  )
}

interface JournalNavigationControlsProps {
  blocked: boolean
  currentDate: LocalDate
  disabled: boolean
  nextDate: LocalDate | null
  onNavigate: (direction: JournalTurnDirection) => void
  previousDate: LocalDate | null
}

export function JournalNavigationControls({
  blocked,
  currentDate,
  disabled,
  nextDate,
  onNavigate,
  previousDate,
}: JournalNavigationControlsProps) {
  const turnDisabled = disabled
  return (
    <nav className="journal-page-navigation-controls" aria-label="日记翻页">
      <IconButton
        className="journal-turn-button is-previous"
        aria-disabled={blocked || undefined}
        disabled={turnDisabled || !previousDate}
        label={`上一页，${formatLocalDate(previousDate ?? currentDate)}`}
        onClick={() => onNavigate('previous')}
        variant="secondary"
      >
        <Undo2 aria-hidden="true" size={22} strokeWidth={1.9} />
      </IconButton>
      <IconButton
        className="journal-turn-button is-next"
        aria-disabled={blocked || undefined}
        disabled={turnDisabled || !nextDate}
        label={`下一页，${formatLocalDate(nextDate ?? currentDate)}`}
        onClick={() => onNavigate('next')}
        variant="secondary"
      >
        <Redo2 aria-hidden="true" size={22} strokeWidth={1.9} />
      </IconButton>
    </nav>
  )
}
