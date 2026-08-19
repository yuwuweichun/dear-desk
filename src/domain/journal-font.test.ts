import {
  DEFAULT_JOURNAL_FONT_ID,
  JOURNAL_FONT_STORAGE_KEY,
  readJournalFontPreference,
  writeJournalFontPreference,
} from './journal-font'

describe('journal font preference', () => {
  it('reads and writes a supported font', () => {
    const values = new Map<string, string>()
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    }

    writeJournalFontPreference(storage, 'xuandong')

    expect(values.get(JOURNAL_FONT_STORAGE_KEY)).toBe('xuandong')
    expect(readJournalFontPreference(storage)).toBe('xuandong')
  })

  it('falls back when the stored font is unavailable in the current build', () => {
    const storage = { getItem: () => 'jingjing' }

    expect(readJournalFontPreference(storage, ['paper'])).toBe(DEFAULT_JOURNAL_FONT_ID)
  })

  it('falls back when storage access fails', () => {
    const storage = {
      getItem: () => {
        throw new Error('blocked')
      },
    }

    expect(readJournalFontPreference(storage)).toBe(DEFAULT_JOURNAL_FONT_ID)
  })
})
