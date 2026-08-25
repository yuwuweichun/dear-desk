import { fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'

import {
  DEFAULT_AUDIO_PREFERENCES,
  type AudioPreferences,
} from '../../audio/audio-preferences'
import { AudioSettingsControl } from './AudioSettingsControl'

function TestHost() {
  const [preferences, setPreferences] = useState<AudioPreferences>(
    DEFAULT_AUDIO_PREFERENCES,
  )
  return (
    <AudioSettingsControl
      onChange={setPreferences}
      preferences={preferences}
    />
  )
}

describe('audio settings control', () => {
  it('independently toggles and adjusts music and sound effects', () => {
    render(<TestHost />)

    const button = screen.getByRole('button', { name: '音频设置' })
    expect(button).toHaveAttribute('aria-expanded', 'false')
    fireEvent.click(button)

    expect(screen.getByRole('dialog', { name: '音频设置' })).toBeInTheDocument()
    const musicToggle = screen.getByRole('switch', { name: '音乐开关' })
    const sfxToggle = screen.getByRole('switch', { name: '音效开关' })
    const musicVolume = screen.getByRole('slider', { name: '音乐音量' })
    const sfxVolume = screen.getByRole('slider', { name: '音效音量' })
    expect(musicToggle).not.toBeChecked()
    expect(sfxToggle).toBeChecked()
    expect(musicVolume).toBeDisabled()
    expect(sfxVolume).toHaveValue('60')

    fireEvent.click(musicToggle)
    fireEvent.change(musicVolume, { target: { value: '45' } })
    fireEvent.click(sfxToggle)

    expect(musicToggle).toBeChecked()
    expect(musicVolume).toHaveValue('45')
    expect(sfxToggle).not.toBeChecked()
    expect(sfxVolume).toBeDisabled()
  })

  it('closes on Escape', () => {
    render(<TestHost />)
    fireEvent.click(screen.getByRole('button', { name: '音频设置' }))
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('dialog', { name: '音频设置' })).not.toBeInTheDocument()
  })
})
