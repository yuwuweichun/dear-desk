import {
  DEFAULT_HISTORICAL_ENTRY_TITLE,
  entryTitle,
  type DailyEntry,
  type LocalDate,
} from './daily-entry'
import type { JournalStickerDateCount } from './sticker'

export const PAST_TRACE_DRAWER_DURATION_SECONDS = 0.3
export const PAST_TRACE_PREVIEW_LENGTH = 72

export interface PastTraceSummary {
  date: LocalDate
  hasEntry: boolean
  stickerCount: number
  textPreview: string
  title: string
}

const previewText = (text: string) => {
  const normalized = text.replace(/\s+/g, ' ').trim()
  return normalized.length > PAST_TRACE_PREVIEW_LENGTH
    ? `${normalized.slice(0, PAST_TRACE_PREVIEW_LENGTH - 1)}...`
    : normalized
}

export const buildPastTraceSummaries = (
  entries: readonly DailyEntry[],
  stickerCounts: readonly JournalStickerDateCount[],
  today: LocalDate,
): PastTraceSummary[] => {
  const entriesByDate = new Map(entries.map((entry) => [entry.date, entry]))
  const stickerCountsByDate = new Map(
    stickerCounts.map(({ count, date }) => [date, Math.max(0, count)]),
  )
  const dates = new Set<LocalDate>([
    ...entries.map((entry) => entry.date),
    ...stickerCounts.map(({ date }) => date),
  ])

  return [...dates]
    .filter((date) => date < today)
    .sort((left, right) => right.localeCompare(left))
    .map((date) => {
      const entry = entriesByDate.get(date) ?? null
      return {
        date,
        hasEntry: Boolean(entry),
        stickerCount: stickerCountsByDate.get(date) ?? 0,
        textPreview: entry ? previewText(entry.text) : '',
        title: entry
          ? entryTitle(entry, false)
          : DEFAULT_HISTORICAL_ENTRY_TITLE,
      }
    })
}

export const pastTraceMonthKey = (date: LocalDate) => date.slice(0, 7)

export const formatPastTraceMonth = (monthKey: string) => {
  const [year, month] = monthKey.split('-').map(Number)
  return new Intl.DateTimeFormat('zh-CN', {
    month: 'long',
    year: 'numeric',
  }).format(new Date(year ?? 0, (month ?? 1) - 1, 1))
}
