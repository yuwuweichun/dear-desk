import { afterEach, describe, expect, it, vi } from 'vitest'

import { createAudioController } from './audio-controller'
import { DEFAULT_AUDIO_PREFERENCES } from './audio-preferences'

class FakeAudio {
  currentTime = 8
  preload = ''
  src: string
  volume = 1
  load = vi.fn()
  pause = vi.fn()
  play = vi.fn().mockResolvedValue(undefined)
  removeAttribute = vi.fn()

  constructor(source: string) {
    this.src = source
  }
}

afterEach(() => {
  vi.useRealTimers()
})

describe('audio controller', () => {
  it('preloads every sound effect once without playing it', () => {
    const players: FakeAudio[] = []
    const controller = createAudioController(DEFAULT_AUDIO_PREFERENCES, (source) => {
      const player = new FakeAudio(source)
      players.push(player)
      return player
    })

    controller.preloadSfx()

    expect(players).toHaveLength(5)
    players.forEach((player) => {
      expect(player.load).toHaveBeenCalledOnce()
      expect(player.play).not.toHaveBeenCalled()
    })
  })

  it('plays, rewinds, and reuses one player per semantic effect', () => {
    const players: FakeAudio[] = []
    const controller = createAudioController(DEFAULT_AUDIO_PREFERENCES, (source) => {
      const player = new FakeAudio(source)
      players.push(player)
      return player
    })

    controller.playSfx('page-turn')
    controller.playSfx('page-turn')

    expect(players).toHaveLength(1)
    expect(players[0]?.src).toBe('/audio/page-turn.mp3')
    expect(players[0]?.currentTime).toBe(0)
    expect(players[0]?.volume).toBe(0.6)
    expect(players[0]?.play).toHaveBeenCalledTimes(2)
  })

  it('does not create a player while SFX are disabled', () => {
    const createPlayer = vi.fn((source: string) => new FakeAudio(source))
    const controller = createAudioController({
      ...DEFAULT_AUDIO_PREFERENCES,
      sfx: { enabled: false, volume: 0.6 },
    }, createPlayer)

    controller.playSfx('drawer-open')

    expect(createPlayer).not.toHaveBeenCalled()
  })

  it('checks the latest preference when a delayed effect becomes due', () => {
    vi.useFakeTimers()
    const player = new FakeAudio('/audio/notebook-close.mp3')
    const controller = createAudioController(DEFAULT_AUDIO_PREFERENCES, () => player)

    controller.playSfx('notebook-close', 900)
    controller.setPreferences({
      ...DEFAULT_AUDIO_PREFERENCES,
      sfx: { enabled: false, volume: 0.6 },
    })
    vi.advanceTimersByTime(900)

    expect(player.play).not.toHaveBeenCalled()
  })

  it('stops players and releases their sources on disposal', () => {
    const player = new FakeAudio('/audio/drawer-close.mp3')
    const controller = createAudioController(DEFAULT_AUDIO_PREFERENCES, () => player)
    controller.playSfx('drawer-close')

    controller.dispose()

    expect(player.pause).toHaveBeenCalled()
    expect(player.removeAttribute).toHaveBeenCalledWith('src')
    expect(player.load).toHaveBeenCalled()
  })

  it('reactivates after a StrictMode cleanup probe replays preferences', () => {
    const players: FakeAudio[] = []
    const controller = createAudioController(DEFAULT_AUDIO_PREFERENCES, (source) => {
      const player = new FakeAudio(source)
      players.push(player)
      return player
    })

    controller.dispose()
    controller.setPreferences(DEFAULT_AUDIO_PREFERENCES)
    controller.playSfx('notebook-open')

    expect(players).toHaveLength(1)
    expect(players[0]?.play).toHaveBeenCalledOnce()
  })
})
