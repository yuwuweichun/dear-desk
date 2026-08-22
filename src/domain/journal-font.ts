// Keep the legacy key so existing journal font preferences become global content preferences.
export const CONTENT_FONT_STORAGE_KEY = 'dear-desk:journal-font'

export const CONTENT_FONT_IDS = ['paper', 'xuandong', 'suifeng', 'zhimang'] as const

export type ContentFontId = (typeof CONTENT_FONT_IDS)[number]

export interface ContentFontOption {
  id: ContentFontId
  label: string
  sample: string
}

export const DEFAULT_CONTENT_FONT_ID: ContentFontId = 'paper'

export const CONTENT_FONT_OPTIONS: readonly ContentFontOption[] = [
  { id: 'paper', label: '纸页宋体', sample: '字' },
  { id: 'xuandong', label: '玄冬楷书', sample: '字' },
  { id: 'suifeng', label: '随峰体', sample: '字' },
  { id: 'zhimang', label: '志莽行书', sample: '字' },
]

export const CONTENT_FONT_FAMILIES: Readonly<Record<ContentFontId, string>> = {
  paper: 'Georgia, "Songti SC", serif',
  xuandong: '"Xuandong Kaishu", "Songti SC", serif',
  suifeng: '"The Peak Font Plus", "Songti SC", serif',
  zhimang: '"Zhi Mang Xing", "Songti SC", serif',
}

interface ReadableStorage {
  getItem(key: string): string | null
}

interface WritableStorage {
  setItem(key: string, value: string): void
}

export const isContentFontId = (value: unknown): value is ContentFontId =>
  typeof value === 'string' && CONTENT_FONT_IDS.includes(value as ContentFontId)

export const readContentFontPreference = (
  storage: ReadableStorage,
  allowed: readonly ContentFontId[] = CONTENT_FONT_IDS,
): ContentFontId => {
  try {
    const value = storage.getItem(CONTENT_FONT_STORAGE_KEY)
    return isContentFontId(value) && allowed.includes(value)
      ? value
      : DEFAULT_CONTENT_FONT_ID
  } catch {
    return DEFAULT_CONTENT_FONT_ID
  }
}

export const writeContentFontPreference = (
  storage: WritableStorage,
  fontId: ContentFontId,
) => {
  try {
    storage.setItem(CONTENT_FONT_STORAGE_KEY, fontId)
  } catch {
    // Storage can be unavailable in private or restricted browser contexts.
  }
}
