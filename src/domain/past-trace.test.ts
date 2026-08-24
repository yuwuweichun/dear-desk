import { describe, expect, it } from 'vitest'

import type { DailyEntry, LocalDate } from './daily-entry'
import { buildPastTraceSummaries, formatPastTraceMonth } from './past-trace'

const entry = (date: LocalDate, text: string, title?: string): DailyEntry => ({
  date,
  title,
  text,
  createdAt: `${date}T01:00:00.000Z`,
  updatedAt: `${date}T01:00:00.000Z`,
})

describe('past trace summaries', () => {
  it('merges entries and sticker-only dates while excluding today and future dates', () => {
    const summaries = buildPastTraceSummaries(
      [
        entry('2026-08-20', '  一段\n过去的文字  ', '旧日晴光'),
        entry('2026-08-24', '今天'),
        entry('2026-08-25', '未来'),
      ],
      [
        { count: 2, date: '2026-08-20' },
        { count: 1, date: '2026-07-03' },
      ],
      '2026-08-24',
    )

    expect(summaries).toEqual([
      {
        date: '2026-08-20',
        hasEntry: true,
        stickerCount: 2,
        textPreview: '一段 过去的文字',
        title: '旧日晴光',
      },
      {
        date: '2026-07-03',
        hasEntry: false,
        stickerCount: 1,
        textPreview: '',
        title: '日记',
      },
    ])
    expect(formatPastTraceMonth('2026-08')).toContain('2026')
    expect(formatPastTraceMonth('2026-08')).toContain('8月')
  })
})
