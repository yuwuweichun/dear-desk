import { Music2, Volume2, VolumeX, Waves } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'

import type {
  AudioChannelPreference,
  AudioPreferences,
} from '../../audio/audio-preferences'
import { IconButton } from '../../ui'

interface AudioSettingsControlProps {
  onChange: (preferences: AudioPreferences) => void
  preferences: AudioPreferences
}

interface AudioChannelControlProps {
  channel: AudioChannelPreference
  icon: ReactNode
  label: string
  onChange: (channel: AudioChannelPreference) => void
}

function AudioChannelControl({
  channel,
  icon,
  label,
  onChange,
}: AudioChannelControlProps) {
  const percent = Math.round(channel.volume * 100)

  return (
    <div className="audio-channel-control">
      <div className="audio-channel-control__header">
        <span className="audio-channel-control__label">
          {icon}
          <span>{label}</span>
        </span>
        <label className="audio-channel-toggle">
          <span className="sr-only">{label}开关</span>
          <input
            aria-label={`${label}开关`}
            checked={channel.enabled}
            onChange={(event) => onChange({
              ...channel,
              enabled: event.target.checked,
            })}
            role="switch"
            type="checkbox"
          />
          <span aria-hidden="true" className="audio-channel-toggle__track" />
        </label>
      </div>
      <div className="audio-channel-control__volume">
        <input
          aria-label={`${label}音量`}
          disabled={!channel.enabled}
          max="100"
          min="0"
          onChange={(event) => onChange({
            ...channel,
            volume: Number(event.target.value) / 100,
          })}
          step="1"
          type="range"
          value={percent}
        />
        <output aria-label={`${label}音量百分比`}>{percent}%</output>
      </div>
    </div>
  )
}

export function AudioSettingsControl({
  onChange,
  preferences,
}: AudioSettingsControlProps) {
  const [open, setOpen] = useState(false)
  const controlRef = useRef<HTMLDivElement>(null)
  const audible = preferences.music.enabled || preferences.sfx.enabled

  useEffect(() => {
    if (!open) return
    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (!controlRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', closeOnOutsidePointer)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsidePointer)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [open])

  const updateChannel = (
    channel: 'music' | 'sfx',
    value: AudioChannelPreference,
  ) => onChange({ ...preferences, [channel]: value })

  return (
    <div className="audio-settings-control" ref={controlRef}>
      <IconButton
        aria-controls="audio-settings-panel"
        aria-expanded={open}
        aria-haspopup="dialog"
        className="audio-settings-button"
        label="音频设置"
        onClick={() => setOpen((value) => !value)}
        showTitle={false}
        variant="secondary"
      >
        {audible ? (
          <Volume2 aria-hidden="true" size={20} strokeWidth={1.8} />
        ) : (
          <VolumeX aria-hidden="true" size={20} strokeWidth={1.8} />
        )}
      </IconButton>
      {open ? (
        <section
          aria-label="音频设置"
          className="audio-settings-panel"
          id="audio-settings-panel"
          role="dialog"
        >
          <header>
            <span>声音</span>
            <strong>音频设置</strong>
          </header>
          <AudioChannelControl
            channel={preferences.music}
            icon={<Music2 aria-hidden="true" size={17} strokeWidth={1.8} />}
            label="音乐"
            onChange={(value) => updateChannel('music', value)}
          />
          <AudioChannelControl
            channel={preferences.sfx}
            icon={<Waves aria-hidden="true" size={17} strokeWidth={1.8} />}
            label="音效"
            onChange={(value) => updateChannel('sfx', value)}
          />
        </section>
      ) : null}
    </div>
  )
}
