export const WALLPAPER_STORAGE_KEY = 'dear-desk:wallpaper-theme'

export const WALLPAPER_THEME_IDS = ['plain', 'candy-cloud'] as const

export type WallpaperThemeId = (typeof WALLPAPER_THEME_IDS)[number]

export const WALLPAPER_FACE_IDS = ['west', 'north', 'east', 'ceiling', 'south'] as const

export type WallpaperFace = (typeof WALLPAPER_FACE_IDS)[number]

export const CANDY_CLOUD_ATLAS_LAYOUT: Readonly<Record<WallpaperFace, readonly [number, number]>> = {
  west: [0, 0],
  north: [1, 0],
  east: [2, 0],
  ceiling: [1, 1],
  south: [2, 1],
}

export interface WallpaperThemeOption {
  id: WallpaperThemeId
  label: string
  atlasPath?: string
  atlasColumns?: number
  atlasRows?: number
  atlasLayout?: Readonly<Record<WallpaperFace, readonly [number, number]>>
  atlasCellOrigin?: readonly [number, number]
  atlasCellSize?: readonly [number, number]
}

export const DEFAULT_WALLPAPER_THEME_ID: WallpaperThemeId = 'plain'

export const WALLPAPER_THEME_OPTIONS: readonly WallpaperThemeOption[] = [
  { id: 'plain', label: '原墙面' },
  {
    id: 'candy-cloud',
    label: 'Candy Cloud',
    atlasPath: '/assets/wallpapers/candy-cloud-cube-net.png',
    atlasColumns: 3,
    atlasRows: 2,
    atlasLayout: CANDY_CLOUD_ATLAS_LAYOUT,
    atlasCellOrigin: [0.02, 0.028],
    atlasCellSize: [1 / 3, 1 / 2],
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
