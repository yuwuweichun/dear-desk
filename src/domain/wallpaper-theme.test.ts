import { describe, expect, it } from 'vitest'

import {
  DEFAULT_WALLPAPER_THEME_ID,
  WALLPAPER_STORAGE_KEY,
  readWallpaperThemePreference,
  writeWallpaperThemePreference,
} from './wallpaper-theme'

describe('wallpaper theme preference', () => {
  it('defaults safely and restores a supported theme', () => {
    const values = new Map<string, string>()
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    }

    expect(readWallpaperThemePreference(storage)).toBe(DEFAULT_WALLPAPER_THEME_ID)
    writeWallpaperThemePreference(storage, 'candy-cloud')
    expect(values.get(WALLPAPER_STORAGE_KEY)).toBe('candy-cloud')
    expect(readWallpaperThemePreference(storage)).toBe('candy-cloud')
  })

  it('ignores unknown values', () => {
    const storage = { getItem: () => 'future-theme' }
    expect(readWallpaperThemePreference(storage)).toBe(DEFAULT_WALLPAPER_THEME_ID)
  })
})
