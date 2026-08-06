export const MAX_ENTRY_LENGTH = 500

export type LocalDate = `${number}-${number}-${number}`

export interface DailyEntry {
  date: LocalDate
  text: string
  createdAt: string
  updatedAt: string
}

export interface DailyEntryRepository {
  getByDate(date: LocalDate): Promise<DailyEntry | null>
  save(date: LocalDate, text: string): Promise<DailyEntry>
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

export const formatLocalDate = (date: LocalDate) => {
  const [year, month, day] = date.split('-').map(Number)
  const localDate = new Date(year ?? 0, (month ?? 1) - 1, day ?? 1)

  return new Intl.DateTimeFormat('zh-CN', {
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  }).format(localDate)
}
