import {
  CanvasTexture,
  RepeatWrapping,
  SRGBColorSpace,
  type Texture,
} from 'three'

export const SCENE_PALETTE = {
  background: '#151d1a',
  brass: '#c49a5a',
  brassDark: '#8e6938',
  burgundy: '#a4484f',
  burgundyDark: '#733239',
  charcoal: '#2d2923',
  cloth: '#314b43',
  clothDark: '#203730',
  honeyWood: '#a7744f',
  paper: '#f3e9d5',
  paperEdge: '#d8c8ad',
  pottery: '#ddd2bd',
  walnut: '#6b4934',
  walnutDark: '#4c3023',
} as const

type ProceduralSurface = 'cloth' | 'wood'

const seededNoise = (index: number) => {
  const value = Math.sin(index * 91.733 + 17.21) * 43758.5453
  return value - Math.floor(value)
}

export function createSurfaceTexture(surface: ProceduralSurface): Texture {
  const canvas = document.createElement('canvas')
  canvas.width = 128
  canvas.height = 128
  const context = canvas.getContext('2d')

  if (!context) return new CanvasTexture(canvas)

  if (surface === 'wood') {
    const gradient = context.createLinearGradient(0, 0, 128, 0)
    gradient.addColorStop(0, '#76513b')
    gradient.addColorStop(0.5, '#9a6848')
    gradient.addColorStop(1, '#694632')
    context.fillStyle = gradient
    context.fillRect(0, 0, 128, 128)

    for (let index = 0; index < 34; index += 1) {
      const y = seededNoise(index) * 128
      const bend = (seededNoise(index + 50) - 0.5) * 12
      context.beginPath()
      context.moveTo(-8, y)
      context.bezierCurveTo(36, y + bend, 84, y - bend, 136, y + bend * 0.4)
      context.strokeStyle = `rgba(70, 39, 25, ${0.035 + seededNoise(index + 90) * 0.075})`
      context.lineWidth = 0.5 + seededNoise(index + 130) * 1.2
      context.stroke()
    }
  } else {
    context.fillStyle = '#365148'
    context.fillRect(0, 0, 128, 128)
    for (let index = 0; index < 128; index += 4) {
      const alpha = 0.025 + seededNoise(index) * 0.035
      context.fillStyle = `rgba(240, 232, 211, ${alpha})`
      context.fillRect(index, 0, 1, 128)
      context.fillRect(0, index + 1, 128, 1)
    }
  }

  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  texture.wrapS = RepeatWrapping
  texture.wrapT = RepeatWrapping
  texture.repeat.set(surface === 'wood' ? 2.5 : 5, surface === 'wood' ? 3 : 6)
  texture.needsUpdate = true
  return texture
}
