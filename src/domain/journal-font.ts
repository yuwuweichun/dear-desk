export const JOURNAL_FONT_STORAGE_KEY = 'dear-desk:journal-font'

export const JOURNAL_FONT_IDS = ['paper', 'jingjing', 'xuandong', 'suifeng'] as const

export type JournalFontId = (typeof JOURNAL_FONT_IDS)[number]

export interface JournalFontOption {
  id: JournalFontId
  label: string
  sample: string
}

export const DEFAULT_JOURNAL_FONT_ID: JournalFontId = 'paper'

export const JOURNAL_FONT_OPTIONS: readonly JournalFontOption[] = [
  { id: 'paper', label: '纸页宋体', sample: '字' },
  { id: 'jingjing', label: '云峰晶晶体', sample: '字' },
  { id: 'xuandong', label: '玄冬楷书', sample: '字' },
  { id: 'suifeng', label: '随峰体', sample: '字' },
]

interface ReadableStorage {
  getItem(key: string): string | null
}

interface WritableStorage {
  setItem(key: string, value: string): void
}

export const isJournalFontId = (value: unknown): value is JournalFontId =>
  typeof value === 'string' && JOURNAL_FONT_IDS.includes(value as JournalFontId)

export const readJournalFontPreference = (
  storage: ReadableStorage,
  allowed: readonly JournalFontId[] = JOURNAL_FONT_IDS,
): JournalFontId => {
  try {
    const value = storage.getItem(JOURNAL_FONT_STORAGE_KEY)
    return isJournalFontId(value) && allowed.includes(value)
      ? value
      : DEFAULT_JOURNAL_FONT_ID
  } catch {
    return DEFAULT_JOURNAL_FONT_ID
  }
}

export const writeJournalFontPreference = (
  storage: WritableStorage,
  fontId: JournalFontId,
) => {
  try {
    storage.setItem(JOURNAL_FONT_STORAGE_KEY, fontId)
  } catch {
    // Storage can be unavailable in private or restricted browser contexts.
  }
}
