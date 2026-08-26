import { describe, expect, it } from 'vitest'

import {
  MAX_SCENE_COLOR_PRESET_NAME_LENGTH,
  normalizeSceneColorPresetName,
  normalizeSceneColors,
  sceneColorsEqual,
  type SceneColorConfig,
} from './scene-color-preset'

const colors: SceneColorConfig = {
  background: '#D5DAD8',
  deskFrame: '#593219',
  deskInset: '#70401F',
  deskLegs: '#593219',
  deskTop: '#73411F',
  matBinding: '#2D2C1E',
  matField: '#3E3B29',
  notebookCover: '#173F35',
  notebookJoint: '#0E2D27',
}

describe('scene color presets', () => {
  it('normalizes names and enforces the visible length limit', () => {
    expect(normalizeSceneColorPresetName('  雨天   书桌  ')).toBe('雨天 书桌')
    expect(() => normalizeSceneColorPresetName('   ')).toThrow('请输入预设名称')
    expect(() => normalizeSceneColorPresetName(
      'x'.repeat(MAX_SCENE_COLOR_PRESET_NAME_LENGTH + 1),
    )).toThrow(`不能超过 ${MAX_SCENE_COLOR_PRESET_NAME_LENGTH} 个字符`)
  })

  it('copies and normalizes all nine HEX values', () => {
    const normalized = normalizeSceneColors(colors)
    expect(normalized).not.toBe(colors)
    expect(normalized.background).toBe('#d5dad8')
    expect(Object.keys(normalized)).toHaveLength(9)
    expect(sceneColorsEqual(colors, normalized)).toBe(true)
    expect(() => normalizeSceneColors({ ...colors, deskTop: '#fff' }))
      .toThrow('无效的 HEX')
  })
})

