export const AUDIO_PREFERENCES_STORAGE_KEY = 'dear-desk:audio-preferences'

export interface AudioChannelPreference {
  enabled: boolean
  volume: number
}

export interface AudioPreferences {
  version: 1
  music: AudioChannelPreference
  sfx: AudioChannelPreference
}

export const DEFAULT_AUDIO_PREFERENCES: AudioPreferences = {
  version: 1,
  music: { enabled: false, volume: 0.3 },
  sfx: { enabled: true, volume: 0.6 },
}

interface ReadableStorage {
  getItem(key: string): string | null
}

interface WritableStorage {
  setItem(key: string, value: string): void
}

const normalizeVolume = (value: unknown, fallback: number) =>
  typeof value === 'number' && Number.isFinite(value)
    ? Math.min(1, Math.max(0, value))
    : fallback

const normalizeChannel = (
  value: unknown,
  fallback: AudioChannelPreference,
): AudioChannelPreference => {
  if (!value || typeof value !== 'object') return { ...fallback }
  const candidate = value as Partial<AudioChannelPreference>
  return {
    enabled: typeof candidate.enabled === 'boolean'
      ? candidate.enabled
      : fallback.enabled,
    volume: normalizeVolume(candidate.volume, fallback.volume),
  }
}

export const normalizeAudioPreferences = (value: unknown): AudioPreferences => {
  if (!value || typeof value !== 'object') {
    return structuredClone(DEFAULT_AUDIO_PREFERENCES)
  }
  const candidate = value as Partial<AudioPreferences>
  if (candidate.version !== 1) {
    return structuredClone(DEFAULT_AUDIO_PREFERENCES)
  }
  return {
    version: 1,
    music: normalizeChannel(candidate.music, DEFAULT_AUDIO_PREFERENCES.music),
    sfx: normalizeChannel(candidate.sfx, DEFAULT_AUDIO_PREFERENCES.sfx),
  }
}

export const readAudioPreferences = (storage: ReadableStorage): AudioPreferences => {
  try {
    const stored = storage.getItem(AUDIO_PREFERENCES_STORAGE_KEY)
    return stored ? normalizeAudioPreferences(JSON.parse(stored)) : normalizeAudioPreferences(null)
  } catch {
    return normalizeAudioPreferences(null)
  }
}

export const writeAudioPreferences = (
  storage: WritableStorage,
  preferences: AudioPreferences,
) => {
  try {
    storage.setItem(
      AUDIO_PREFERENCES_STORAGE_KEY,
      JSON.stringify(normalizeAudioPreferences(preferences)),
    )
  } catch {
    // Storage can be unavailable in private or restricted browser contexts.
  }
}
