import { describe, expect, it } from 'vitest'

import {
  MAX_NOTEBOOK_LABEL_LENGTH,
  normalizeNotebookLabel,
} from './notebook-cover-settings'

describe('notebook cover label', () => {
  it('normalizes whitespace and allows an intentionally empty nameplate', () => {
    expect(normalizeNotebookLabel('  DEAR   DESK  ')).toBe('DEAR DESK')
    expect(normalizeNotebookLabel('   ')).toBe('')
  })

  it('enforces the approved length and character set', () => {
    expect(normalizeNotebookLabel('A'.repeat(MAX_NOTEBOOK_LABEL_LENGTH))).toHaveLength(12)
    expect(() => normalizeNotebookLabel('A'.repeat(13))).toThrow('不能超过 12 个字符')
    expect(normalizeNotebookLabel('亲爱的桌子')).toBe('亲爱的桌子')
    expect(normalizeNotebookLabel('Dear 我的')).toBe('Dear 我的')
    expect(() => normalizeNotebookLabel('A\u0000B')).toThrow('中英文')
  })
})
