import {
  DailyEntryValidationError,
  MAX_ENTRY_LENGTH,
  normalizeEntryText,
  toLocalDate,
} from './daily-entry'

describe('daily entry domain', () => {
  it('uses the browser local calendar date', () => {
    expect(toLocalDate(new Date(2026, 0, 2, 23, 59))).toBe('2026-01-02')
  })

  it('trims valid content', () => {
    expect(normalizeEntryText('  今天很好。  ')).toBe('今天很好。')
  })

  it('rejects empty and oversized content', () => {
    expect(() => normalizeEntryText('   ')).toThrow(DailyEntryValidationError)
    expect(() => normalizeEntryText('a'.repeat(MAX_ENTRY_LENGTH + 1))).toThrow(
      `内容不能超过 ${MAX_ENTRY_LENGTH} 个字符。`,
    )
  })
})
