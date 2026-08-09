import { formatLocalDate, type LocalDate } from '../../domain/daily-entry'
import type { JournalTurnDirection } from '../../state/app-store'

interface PageTurnSheetProps {
  direction: JournalTurnDirection
  fromDate: LocalDate
  onComplete: () => void
  toDate: LocalDate
}

export function PageTurnSheet({
  direction,
  fromDate,
  onComplete,
  toDate,
}: PageTurnSheetProps) {
  return (
    <div
      className={`page-turn-sheet is-${direction}`}
      aria-hidden="true"
      onAnimationEnd={onComplete}
    >
      <div className="page-turn-face page-turn-front">
        <span>{formatLocalDate(fromDate)}</span>
      </div>
      <div className="page-turn-face page-turn-back">
        <span>{formatLocalDate(toDate)}</span>
      </div>
    </div>
  )
}
