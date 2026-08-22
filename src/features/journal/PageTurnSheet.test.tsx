import { render } from '@testing-library/react'

import type { DailyEntry, LocalDate } from '../../domain/daily-entry'
import type { JournalTurnDirection } from '../../state/app-store'
import { PageTurnSheet, type JournalTurnSnapshot } from './PageTurnSheet'

const currentDate = '2026-08-06' as LocalDate
const targetDate = '2026-08-05' as LocalDate

const entry = (date: LocalDate, title: string, text: string): DailyEntry => ({
  date,
  title,
  text,
  createdAt: `${date}T01:00:00.000Z`,
  updatedAt: `${date}T01:00:00.000Z`,
})

const current: JournalTurnSnapshot = {
  date: currentDate,
  entry: entry(currentDate, '今天', '当前页正文'),
  isToday: true,
  stickers: [],
}

const target: JournalTurnSnapshot = {
  date: targetDate,
  entry: entry(targetDate, '昨天', '目标页正文'),
  isToday: false,
  stickers: [],
}

describe('PageTurnSheet', () => {
  it('settles through the static fallback when layout geometry is unavailable', () => {
    vi.useFakeTimers()
    const onComplete = vi.fn()

    render(
      <PageTurnSheet
        current={current}
        direction="next"
        onComplete={onComplete}
        target={target}
      />,
    )

    vi.advanceTimersByTime(120)
    expect(onComplete).toHaveBeenCalledOnce()
    vi.useRealTimers()
  })

  it.each([
    ['next', [currentDate, currentDate, targetDate, targetDate]],
    ['previous', [targetDate, targetDate, currentDate, currentDate]],
  ] as [JournalTurnDirection, LocalDate[]][])(
    'orders isolated page snapshots for a %s turn',
    (direction, expectedDates) => {
      const { container } = render(
        <PageTurnSheet
          current={current}
          direction={direction}
          onComplete={vi.fn()}
          target={target}
        />,
      )

      const overlay = container.querySelector('.page-turn-overlay')
      const pages = [...container.querySelectorAll<HTMLElement>('.page-turn-snapshot')]
      expect(overlay).toHaveAttribute('data-page-turn-engine', 'page-flip')
      expect(pages.map((page) => page.dataset.pageDate)).toEqual(expectedDates)
      expect(overlay).toHaveTextContent('当前页正文')
      expect(overlay).toHaveTextContent('目标页正文')
      expect(pages.map((page) => page.dataset.snapshotSide)).toEqual([
        'left',
        'right',
        'left',
        'right',
      ])
      const workbenchActions = [
        ...container.querySelectorAll<HTMLElement>('.page-turn-snapshot-action'),
      ]
      expect(workbenchActions).toHaveLength(2)
      expect(workbenchActions.every((action) => action.textContent === '贴纸工作台')).toBe(true)
    },
  )
})
