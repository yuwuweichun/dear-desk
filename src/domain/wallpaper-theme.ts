export const WALLPAPER_STORAGE_KEY = 'dear-desk:wallpaper-theme'

export const WALLPAPER_THEME_IDS = ['plain', 'candy-cloud'] as const

export type WallpaperThemeId = (typeof WALLPAPER_THEME_IDS)[number]

export const WALLPAPER_FACE_IDS = ['west', 'north', 'east', 'ceiling', 'south'] as const

export type WallpaperFace = (typeof WALLPAPER_FACE_IDS)[number]

export interface WallpaperThemeOption {
  id: WallpaperThemeId
  label: string
  panoramaPath?: string
}

export const DEFAULT_WALLPAPER_THEME_ID: WallpaperThemeId = 'plain'

export const WALLPAPER_THEME_OPTIONS: readonly WallpaperThemeOption[] = [
  { id: 'plain', label: '原墙面' },
  {
    id: 'candy-cloud',
    label: 'Candy Cloud',
    panoramaPath: '/assets/wallpapers/candy-cloud-panorama.png',
  },
]

export const getWallpaperTheme = (themeId: WallpaperThemeId) =>
  WALLPAPER_THEME_OPTIONS.find((option) => option.id === themeId) ?? WALLPAPER_THEME_OPTIONS[0]!

interface ReadableStorage {
  getItem(key: string): string | null
}

interface WritableStorage {
  setItem(key: string, value: string): void
}

export const isWallpaperThemeId = (value: unknown): value is WallpaperThemeId =>
  typeof value === 'string' && WALLPAPER_THEME_IDS.includes(value as WallpaperThemeId)

export const readWallpaperThemePreference = (storage: ReadableStorage): WallpaperThemeId => {
  try {
    const value = storage.getItem(WALLPAPER_STORAGE_KEY)
    return isWallpaperThemeId(value) ? value : DEFAULT_WALLPAPER_THEME_ID
  } catch {
    return DEFAULT_WALLPAPER_THEME_ID
  }
}

export const writeWallpaperThemePreference = (
  storage: WritableStorage,
  themeId: WallpaperThemeId,
) => {
  try {
    storage.setItem(WALLPAPER_STORAGE_KEY, themeId)
  } catch {
    // Storage can be unavailable in private or restricted browser contexts.
  }
}
