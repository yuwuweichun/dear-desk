import {
  CONTENT_FONT_FAMILIES,
  CONTENT_FONT_STORAGE_KEY,
  DEFAULT_CONTENT_FONT_ID,
  readContentFontPreference,
  writeContentFontPreference,
} from './journal-font'

describe('global content font preference', () => {
  it('reads and writes a supported font', () => {
    const values = new Map<string, string>()
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    }

    writeContentFontPreference(storage, 'zhimang')

    expect(values.get(CONTENT_FONT_STORAGE_KEY)).toBe('zhimang')
    expect(readContentFontPreference(storage)).toBe('zhimang')
    expect(CONTENT_FONT_FAMILIES.zhimang).toContain('Zhi Mang Xing')
  })

  it('falls back when the stored font is unavailable in the current build', () => {
    const storage = { getItem: () => 'jingjing' }

    expect(readContentFontPreference(storage, ['paper'])).toBe(DEFAULT_CONTENT_FONT_ID)
  })

  it('falls back when storage access fails', () => {
    const storage = {
      getItem: () => {
        throw new Error('blocked')
      },
    }

    expect(readContentFontPreference(storage)).toBe(DEFAULT_CONTENT_FONT_ID)
  })
})
