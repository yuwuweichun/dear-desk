import * as THREE from 'three'

const TEXTURE_WIDTH = 2048
const TEXTURE_HEIGHT = 512
const PLAQUE_TOP_Y = 0.018

export const NAMEPLATE_COLOR_PALETTE = {
  black: { highlight: 'rgba(220, 220, 220, 0.42)', main: '#161616', shadow: 'rgba(0, 0, 0, 0.86)' },
  copper: { highlight: 'rgba(244, 193, 130, 0.48)', main: '#57321f', shadow: 'rgba(35, 16, 7, 0.84)' },
  espresso: { highlight: 'rgba(255, 226, 157, 0.48)', main: '#4a2d15', shadow: 'rgba(24, 13, 5, 0.82)' },
  oxblood: { highlight: 'rgba(229, 157, 148, 0.46)', main: '#5a2424', shadow: 'rgba(35, 8, 10, 0.84)' },
  bronze: { highlight: 'rgba(180, 211, 194, 0.42)', main: '#304238', shadow: 'rgba(8, 22, 19, 0.84)' },
} as const

export type NameplateColor = keyof typeof NAMEPLATE_COLOR_PALETTE

const getNameplateColor = (): NameplateColor => {
  if (typeof window === 'undefined') return 'espresso'
  const value = new URLSearchParams(window.location.search).get('nameplate-color')
  return value && value in NAMEPLATE_COLOR_PALETTE ? value as NameplateColor : 'espresso'
}

const drawEngravedLabel = (label: string) => {
  if (typeof document === 'undefined') return null
  const canvas = document.createElement('canvas')
  canvas.width = TEXTURE_WIDTH
  canvas.height = TEXTURE_HEIGHT
  const context = canvas.getContext('2d')
  if (!context) return null

  context.clearRect(0, 0, TEXTURE_WIDTH, TEXTURE_HEIGHT)
  context.textAlign = 'center'
  context.textBaseline = 'middle'
  context.font = '700 250px "Xuandong Kaishu", "Noto Sans SC", serif'
  const metrics = context.measureText(label)
  const scale = Math.min(1, 1740 / Math.max(metrics.width, 1))
  const colors = NAMEPLATE_COLOR_PALETTE[getNameplateColor()]

  context.save()
  context.translate(TEXTURE_WIDTH / 2, TEXTURE_HEIGHT / 2)
  context.scale(scale, scale)
  // Dark recessed core, then a restrained upper-left edge highlight to mimic an engraved bevel.
  context.shadowColor = colors.shadow
  context.shadowBlur = 7
  context.shadowOffsetX = 2
  context.shadowOffsetY = 3
  context.fillStyle = colors.main
  context.fillText(label, 0, 0)
  context.shadowColor = 'transparent'
  context.fillStyle = colors.highlight
  context.fillText(label, -2, -2)
  context.fillStyle = colors.main
  context.fillText(label, 1, 1)
  context.restore()

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 8
  const material = new THREE.MeshPhysicalMaterial({
    alphaTest: 0.06,
    clearcoat: 0.18,
    color: '#b18a45',
    map: texture,
    metalness: 0.84,
    roughness: 0.28,
    transparent: true,
  })
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1.08, 0.22), material)
  mesh.name = 'custom-nameplate-engraving'
  mesh.position.set(0, PLAQUE_TOP_Y, 0)
  mesh.rotation.x = -Math.PI / 2
  return mesh
}

export const createNameplateText = (label: string) =>
  label ? drawEngravedLabel(label) : null
