import {
  AUDIO_PREFERENCES_STORAGE_KEY,
  DEFAULT_AUDIO_PREFERENCES,
  normalizeAudioPreferences,
  readAudioPreferences,
  writeAudioPreferences,
} from './audio-preferences'

describe('audio preferences', () => {
  it('uses quiet defaults and round-trips a supported preference', () => {
    const values = new Map<string, string>()
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    }

    expect(readAudioPreferences(storage)).toEqual(DEFAULT_AUDIO_PREFERENCES)
    writeAudioPreferences(storage, {
      version: 1,
      music: { enabled: true, volume: 0.42 },
      sfx: { enabled: false, volume: 0.75 },
    })

    expect(JSON.parse(values.get(AUDIO_PREFERENCES_STORAGE_KEY) ?? '')).toEqual({
      version: 1,
      music: { enabled: true, volume: 0.42 },
      sfx: { enabled: false, volume: 0.75 },
    })
    expect(readAudioPreferences(storage).sfx.enabled).toBe(false)
  })

  it('clamps volumes and falls back for unsupported versions', () => {
    expect(normalizeAudioPreferences({
      version: 1,
      music: { enabled: true, volume: 4 },
      sfx: { enabled: false, volume: -2 },
    })).toEqual({
      version: 1,
      music: { enabled: true, volume: 1 },
      sfx: { enabled: false, volume: 0 },
    })
    expect(normalizeAudioPreferences({ version: 2 })).toEqual(DEFAULT_AUDIO_PREFERENCES)
  })

  it('falls back when JSON or storage access is unavailable', () => {
    expect(readAudioPreferences({ getItem: () => '{bad json' })).toEqual(
      DEFAULT_AUDIO_PREFERENCES,
    )
    expect(readAudioPreferences({
      getItem: () => {
        throw new Error('blocked')
      },
    })).toEqual(DEFAULT_AUDIO_PREFERENCES)

    expect(() => writeAudioPreferences({
      setItem: () => {
        throw new Error('blocked')
      },
    }, DEFAULT_AUDIO_PREFERENCES)).not.toThrow()
  })
})
