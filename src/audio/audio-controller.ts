import {
  DEFAULT_AUDIO_PREFERENCES,
  normalizeAudioPreferences,
  type AudioPreferences,
} from './audio-preferences'

export const SOUND_EFFECT_SOURCES = {
  'drawer-close': '/audio/drawer-close.mp3',
  'drawer-open': '/audio/drawer-open.mp3',
  'notebook-close': '/audio/notebook-close.mp3',
  'notebook-open': '/audio/notebook-open.mp3',
  'page-turn': '/audio/page-turn.mp3',
} as const

export const NOTEBOOK_CLOSE_SOUND_DURATION_SECONDS = 0.696

export type SoundEffectId = keyof typeof SOUND_EFFECT_SOURCES

interface PlayableAudio {
  currentTime: number
  preload: string
  src: string
  volume: number
  load(): void
  pause(): void
  play(): Promise<void> | void
  removeAttribute(name: string): void
}

type AudioFactory = (source: string) => PlayableAudio

export interface AudioController {
  dispose(): void
  preloadSfx(): void
  playSfx(effect: SoundEffectId, delayMs?: number): void
  setPreferences(preferences: AudioPreferences): void
}

const createBrowserAudio: AudioFactory = (source) => new Audio(source)

export const createAudioController = (
  initialPreferences: AudioPreferences = DEFAULT_AUDIO_PREFERENCES,
  createAudio: AudioFactory = createBrowserAudio,
): AudioController => {
  let preferences = normalizeAudioPreferences(initialPreferences)
  let disposed = false
  const audioElements = new Map<SoundEffectId, PlayableAudio>()
  const pendingTimers = new Map<SoundEffectId, number>()

  const audioFor = (effect: SoundEffectId) => {
    const existing = audioElements.get(effect)
    if (existing) return existing
    const audio = createAudio(SOUND_EFFECT_SOURCES[effect])
    audio.preload = 'auto'
    audioElements.set(effect, audio)
    return audio
  }

  const playNow = (effect: SoundEffectId) => {
    if (disposed || !preferences.sfx.enabled || preferences.sfx.volume <= 0) return
    const audio = audioFor(effect)
    audio.pause()
    audio.currentTime = 0
    audio.volume = preferences.sfx.volume
    try {
      const playback = audio.play()
      if (playback && typeof playback.catch === 'function') {
        void playback.catch(() => undefined)
      }
    } catch {
      // Audio is enhancement-only; playback failures must not block the action.
    }
  }

  return {
    preloadSfx() {
      if (disposed) return
      for (const effect of Object.keys(SOUND_EFFECT_SOURCES) as SoundEffectId[]) {
        audioFor(effect).load()
      }
      console.info('[audio] SFX preload initialized', {
        count: audioElements.size,
        effects: [...audioElements.keys()],
        note: 'Audio objects created and load() called; media decoding may still be in progress.',
      })
    },
    setPreferences(nextPreferences) {
      // React StrictMode replays effects after a cleanup-only mount probe.
      disposed = false
      preferences = normalizeAudioPreferences(nextPreferences)
      for (const audio of audioElements.values()) {
        audio.volume = preferences.sfx.volume
        if (!preferences.sfx.enabled) audio.pause()
      }
    },
    playSfx(effect, delayMs = 0) {
      const pendingTimer = pendingTimers.get(effect)
      if (pendingTimer !== undefined) window.clearTimeout(pendingTimer)
      if (delayMs <= 0) {
        pendingTimers.delete(effect)
        playNow(effect)
        return
      }
      const timer = window.setTimeout(() => {
        pendingTimers.delete(effect)
        playNow(effect)
      }, delayMs)
      pendingTimers.set(effect, timer)
    },
    dispose() {
      disposed = true
      for (const timer of pendingTimers.values()) window.clearTimeout(timer)
      pendingTimers.clear()
      for (const audio of audioElements.values()) {
        audio.pause()
        audio.removeAttribute('src')
        audio.load()
      }
      audioElements.clear()
    },
  }
}
