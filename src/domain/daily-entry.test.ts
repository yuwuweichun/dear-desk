import {
  defaultEntryTitle,
  MAX_ENTRY_TITLE_LENGTH,
  MAX_ENTRY_LENGTH,
  normalizeEntryTitle,
  normalizeEntryText,
  sortLocalDates,
  toLocalDate,
} from './daily-entry'

describe('daily entry domain', () => {
  it('uses the browser local calendar date', () => {
    expect(toLocalDate(new Date(2026, 0, 2, 23, 59))).toBe('2026-01-02')
  })

  it('trims valid content', () => {
    expect(normalizeEntryText('  今天很好。  ')).toBe('今天很好。')
  })

  it('allows empty and rejects oversized content', () => {
    expect(normalizeEntryText('   ')).toBe('')
    expect(() => normalizeEntryText('a'.repeat(MAX_ENTRY_LENGTH + 1))).toThrow(
      `内容不能超过 ${MAX_ENTRY_LENGTH} 个字符。`,
    )
  })

  it('normalizes and validates titles with date-based defaults', () => {
    expect(normalizeEntryTitle('  今天的光  ')).toBe('今天的光')
    expect(() => normalizeEntryTitle('   ')).toThrow('请先写一个标题。')
    expect(() => normalizeEntryTitle('a'.repeat(MAX_ENTRY_TITLE_LENGTH + 1))).toThrow(
      `标题不能超过 ${MAX_ENTRY_TITLE_LENGTH} 个字符。`,
    )
    expect(defaultEntryTitle(true)).toBe('今天')
    expect(defaultEntryTitle(false)).toBe('日记')
  })

  it('sorts and deduplicates local dates for journal pages', () => {
    expect(sortLocalDates([
      '2026-08-08',
      '2026-08-06',
      '2026-08-08',
      '2026-08-07',
    ])).toEqual(['2026-08-06', '2026-08-07', '2026-08-08'])
  })
})
