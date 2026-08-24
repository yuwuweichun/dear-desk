export const MAX_ENTRY_LENGTH = 500
export const MAX_ENTRY_TITLE_LENGTH = 80
export const DEFAULT_TODAY_ENTRY_TITLE = '今天'
export const DEFAULT_HISTORICAL_ENTRY_TITLE = '日记'

export type LocalDate = `${number}-${number}-${number}`

export interface DailyEntry {
  date: LocalDate
  /** Optional at runtime so records written before title support remain readable. */
  title?: string
  text: string
  createdAt: string
  updatedAt: string
}

export interface DailyEntryRepository {
  getByDate(date: LocalDate): Promise<DailyEntry | null>
  listEntries(): Promise<DailyEntry[]>
  listDates(): Promise<LocalDate[]>
  save(date: LocalDate, text: string, title?: string): Promise<DailyEntry>
}

export class DailyEntryValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'DailyEntryValidationError'
  }
}

const padDatePart = (value: number) => String(value).padStart(2, '0')

export const toLocalDate = (date = new Date()): LocalDate =>
  `${date.getFullYear()}-${padDatePart(date.getMonth() + 1)}-${padDatePart(date.getDate())}` as LocalDate

export const normalizeEntryText = (text: string) => {
  const normalized = text.trim()

  if (!normalized) {
    throw new DailyEntryValidationError('请先写下一点内容。')
  }

  if (normalized.length > MAX_ENTRY_LENGTH) {
    throw new DailyEntryValidationError(`内容不能超过 ${MAX_ENTRY_LENGTH} 个字符。`)
  }

  return normalized
}

export const normalizeEntryTitle = (title: string) => {
  const normalized = title.trim()

  if (!normalized) {
    throw new DailyEntryValidationError('请先写一个标题。')
  }

  if (normalized.length > MAX_ENTRY_TITLE_LENGTH) {
    throw new DailyEntryValidationError(
      `标题不能超过 ${MAX_ENTRY_TITLE_LENGTH} 个字符。`,
    )
  }

  return normalized
}

export const defaultEntryTitle = (isToday: boolean) =>
  isToday ? DEFAULT_TODAY_ENTRY_TITLE : DEFAULT_HISTORICAL_ENTRY_TITLE

export const entryTitle = (entry: DailyEntry | null, isToday: boolean) =>
  entry?.title?.trim() || defaultEntryTitle(isToday)

export const formatLocalDate = (date: LocalDate) => {
  const [year, month, day] = date.split('-').map(Number)
  const localDate = new Date(year ?? 0, (month ?? 1) - 1, day ?? 1)

  return new Intl.DateTimeFormat('zh-CN', {
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  }).format(localDate)
}

export const sortLocalDates = (dates: Iterable<LocalDate>) =>
  [...new Set(dates)].sort((left, right) => left.localeCompare(right))
