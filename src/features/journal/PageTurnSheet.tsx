import type { JournalTurnDirection } from '../../state/app-store'

interface PageTurnSheetProps {
  direction: JournalTurnDirection
  onComplete: () => void
}

export function PageTurnSheet({
  direction,
  onComplete,
}: PageTurnSheetProps) {
  return (
    <div
      className={`page-turn-sheet is-${direction}`}
      aria-hidden="true"
      onAnimationEnd={onComplete}
    >
      <div className="page-turn-face page-turn-front" />
      <div className="page-turn-face page-turn-back" />
    </div>
  )
}
