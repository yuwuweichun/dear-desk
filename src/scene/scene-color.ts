import type { SceneColorConfig } from './models/material-library'

const HEX_COLOR = /^#[0-9a-f]{6}$/i

export const isSceneHexColor = (value: string) => HEX_COLOR.test(value)

export const serializeSceneColors = (colors: SceneColorConfig) =>
  JSON.stringify({ version: 'custom', colors }, null, 2)
