import * as THREE from 'three'

export const SCENE_PALETTE = {
  background: '#171c18',
  brass: '#8f6a41',
  brassDark: '#59452d',
  burgundy: '#6f2028',
  cloth: '#35382b',
  clothDark: '#292d22',
  paper: '#e4d5c3',
  paperEdge: '#c8b197',
  walnut: '#64381c',
  walnutDark: '#432613',
} as const

export type SurfaceFamily = 'cloth' | 'paper' | 'wood'
export type SurfaceChannel = 'albedo' | 'ao' | 'height' | 'roughness'

export interface SurfaceSample {
  albedo: [number, number, number]
  ao: number
  height: number
  roughness: number
}

export interface ModelMaterialLibrary {
  brass: THREE.MeshPhysicalMaterial
  brassDark: THREE.MeshPhysicalMaterial
  cloth: THREE.MeshPhysicalMaterial
  clothDark: THREE.MeshPhysicalMaterial
  ground: THREE.MeshStandardMaterial
  neutral: THREE.MeshStandardMaterial
  pageRule: THREE.MeshBasicMaterial
  paper: THREE.MeshStandardMaterial
  paperEdge: THREE.MeshStandardMaterial
  ribbon: THREE.MeshPhysicalMaterial
  stitch: THREE.MeshStandardMaterial
  textureCount: number
  textures: THREE.Texture[]
  walnut: THREE.MeshPhysicalMaterial
  walnutDark: THREE.MeshPhysicalMaterial
  walnutPanel: THREE.MeshPhysicalMaterial
  dispose: () => void
}

const clampByte = (value: number) => Math.max(0, Math.min(255, Math.round(value)))

const hash = (x: number, y: number, seed: number) => {
  let value = Math.imul(x + seed * 17, 374761393) ^ Math.imul(y + seed * 31, 668265263)
  value = Math.imul(value ^ (value >>> 13), 1274126177)
  return ((value ^ (value >>> 16)) >>> 0) / 4_294_967_295
}

const mix = (from: number, to: number, amount: number) =>
  from + (to - from) * amount

const smooth = (value: number) => value * value * (3 - 2 * value)

const wrapCell = (value: number, cellCount: number) =>
  ((value % cellCount) + cellCount) % cellCount

const periodicNoise1d = (coordinate: number, cellCount: number, seed: number) => {
  const scaled = coordinate * cellCount
  const start = Math.floor(scaled)
  const amount = smooth(scaled - start)
  const from = hash(wrapCell(start, cellCount), 0, seed)
  const to = hash(wrapCell(start + 1, cellCount), 0, seed)
  return mix(from, to, amount)
}

const periodicNoise2d = (
  u: number,
  v: number,
  cellsU: number,
  cellsV: number,
  seed: number,
) => {
  const scaledU = u * cellsU
  const scaledV = v * cellsV
  const cellU = Math.floor(scaledU)
  const cellV = Math.floor(scaledV)
  const amountU = smooth(scaledU - cellU)
  const amountV = smooth(scaledV - cellV)
  const left = mix(
    hash(wrapCell(cellU, cellsU), wrapCell(cellV, cellsV), seed),
    hash(wrapCell(cellU, cellsU), wrapCell(cellV + 1, cellsV), seed),
    amountV,
  )
  const right = mix(
    hash(wrapCell(cellU + 1, cellsU), wrapCell(cellV, cellsV), seed),
    hash(wrapCell(cellU + 1, cellsU), wrapCell(cellV + 1, cellsV), seed),
    amountV,
  )
  return mix(left, right, amountU)
}

const threadRidge = (phase: number) =>
  Math.pow(0.5 + Math.cos(phase * Math.PI * 2) * 0.5, 6)

export function sampleSurfaceChannels(
  family: SurfaceFamily,
  x: number,
  y: number,
  size: number,
): SurfaceSample {
  const u = x / size
  const v = y / size

  if (family === 'wood') {
    const flow =
      (periodicNoise2d(u, v, 2, 3, 101) - 0.5) * 0.075 +
      (periodicNoise2d(u, v, 4, 5, 103) - 0.5) * 0.025
    const grainCoordinate = v + flow
    const macro = periodicNoise1d(grainCoordinate, 5, 107)
    const meso = periodicNoise1d(grainCoordinate, 17, 109)
    const micro = periodicNoise1d(grainCoordinate, 53, 113)
    const pore = Math.max(0, 0.16 - micro) / 0.16
    const grain =
      (macro - 0.5) * 0.9 +
      (meso - 0.5) * 0.62 +
      (micro - 0.5) * 0.2
    const value = grain * 15 - pore * 4
    return {
      albedo: [
        clampByte(100 + value),
        clampByte(56 + value * 0.56),
        clampByte(28 + value * 0.3),
      ],
      ao: clampByte(241 + (macro - 0.5) * 7 - pore * 11),
      height: clampByte(
        128 + (macro - 0.5) * 7 + (meso - 0.5) * 12 + (micro - 0.5) * 5 - pore * 5,
      ),
      roughness: clampByte(
        193 - (macro - 0.5) * 9 + (meso - 0.5) * 13 + pore * 8,
      ),
    }
  }

  if (family === 'cloth') {
    const macro = periodicNoise2d(u, v, 3, 3, 41)
    const yarn = periodicNoise2d(u, v, 13, 11, 43)
    const warpCount = Math.max(3, Math.round(size / 18))
    const weftCount = Math.max(3, Math.round(size / 22))
    const twillCount = Math.max(2, Math.round(size / 32))
    const warp = threadRidge(u * warpCount + v * 3)
    const weft = threadRidge(v * weftCount - u * 2)
    const twill = threadRidge((u + v) * twillCount)
    const weave = (warp - 0.23) * 0.58 + (weft - 0.23) * 0.3 + (twill - 0.23) * 0.12
    const interstice = 1 - Math.min(1, warp * 0.64 + weft * 0.36)
    const value = (macro - 0.5) * 7 + (yarn - 0.5) * 3 + weave * 2.4
    return {
      albedo: [
        clampByte(53 + value * 0.72),
        clampByte(56 + value),
        clampByte(43 + value * 0.68),
      ],
      ao: clampByte(240 - interstice * 11 + (macro - 0.5) * 4),
      height: clampByte(
        124 + warp * 15 + weft * 9 + twill * 3 + (yarn - 0.5) * 4,
      ),
      roughness: clampByte(
        228 + interstice * 10 + (macro - 0.5) * 5 - warp * 3,
      ),
    }
  }

  const macro = periodicNoise2d(u, v, 2, 2, 71)
  const cloud = periodicNoise2d(u, v, 8, 7, 73)
  const horizontalFiber = periodicNoise1d(v + u * 0.06, 61, 79)
  const crossFiber = periodicNoise1d(u - v * 0.04, 47, 83)
  const fiber = (horizontalFiber - 0.5) * 0.68 + (crossFiber - 0.5) * 0.32
  const value = (macro - 0.5) * 3 + (cloud - 0.5) * 2 + fiber * 1.4
  return {
    albedo: [
      clampByte(228 + value),
      clampByte(213 + value * 0.84),
      clampByte(195 + value * 0.68),
    ],
    ao: clampByte(246 + (macro - 0.5) * 4 + (cloud - 0.5) * 2),
    height: clampByte(128 + fiber * 8 + (cloud - 0.5) * 3),
    roughness: clampByte(239 - fiber * 7 + (cloud - 0.5) * 4),
  }
}

const createTextureSet = (
  family: SurfaceFamily,
  size: number,
  anisotropy: number,
) => {
  const data = {
    albedo: new Uint8Array(size * size * 4),
    ao: new Uint8Array(size * size * 4),
    height: new Uint8Array(size * size * 4),
    roughness: new Uint8Array(size * size * 4),
  }

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const sample = sampleSurfaceChannels(family, x, y, size)
      const offset = (y * size + x) * 4
      const write = (target: Uint8Array, value: number) => {
        target[offset] = value
        target[offset + 1] = value
        target[offset + 2] = value
        target[offset + 3] = 255
      }
      data.albedo[offset] = sample.albedo[0]
      data.albedo[offset + 1] = sample.albedo[1]
      data.albedo[offset + 2] = sample.albedo[2]
      data.albedo[offset + 3] = 255
      write(data.ao, sample.ao)
      write(data.height, sample.height)
      write(data.roughness, sample.roughness)
    }
  }

  const texture = (channel: SurfaceChannel, pixels: Uint8Array) => {
    const map = new THREE.DataTexture(pixels, size, size, THREE.RGBAFormat)
    map.name = `${family}-${channel}`
    map.colorSpace = channel === 'albedo' ? THREE.SRGBColorSpace : THREE.NoColorSpace
    map.wrapS = THREE.RepeatWrapping
    map.wrapT = THREE.RepeatWrapping
    map.anisotropy = anisotropy
    map.generateMipmaps = true
    map.minFilter = THREE.LinearMipmapLinearFilter
    map.magFilter = THREE.LinearFilter
    map.userData = { channel, family, size }
    map.needsUpdate = true
    return map
  }

  return {
    albedo: texture('albedo', data.albedo),
    ao: texture('ao', data.ao),
    height: texture('height', data.height),
    roughness: texture('roughness', data.roughness),
  }
}

export function createModelMaterialLibrary(
  options: { anisotropy?: number; textureSize?: number } = {},
): ModelMaterialLibrary {
  const size = options.textureSize ?? 1024
  const anisotropy = options.anisotropy ?? 8
  const wood = createTextureSet('wood', size, anisotropy)
  const cloth = createTextureSet('cloth', size, anisotropy)
  const paper = createTextureSet('paper', size, anisotropy)
  const textures = [...Object.values(wood), ...Object.values(cloth), ...Object.values(paper)]

  const walnut = new THREE.MeshPhysicalMaterial({
    aoMap: wood.ao,
    aoMapIntensity: 0.34,
    bumpMap: wood.height,
    bumpScale: 0.006,
    clearcoat: 0.08,
    clearcoatRoughness: 0.64,
    map: wood.albedo,
    roughness: 0.76,
    roughnessMap: wood.roughness,
  })
  walnut.name = 'walnut-top'
  const walnutDark = walnut.clone()
  walnutDark.name = 'walnut-frame'
  walnutDark.color.set('#8c8177')
  walnutDark.roughness = 0.84
  const walnutPanel = walnut.clone()
  walnutPanel.name = 'walnut-panel'
  walnutPanel.color.set('#c8bbb0')
  walnutPanel.roughness = 0.79

  const clothMaterial = new THREE.MeshPhysicalMaterial({
    aoMap: cloth.ao,
    aoMapIntensity: 0.38,
    anisotropy: 0.18,
    anisotropyRotation: Math.PI / 2,
    bumpMap: cloth.height,
    bumpScale: 0.0065,
    map: cloth.albedo,
    roughness: 0.93,
    roughnessMap: cloth.roughness,
    sheen: 0.11,
    sheenColor: new THREE.Color('#5f6251'),
    sheenRoughness: 0.95,
  })
  clothMaterial.name = 'moss-cloth'
  const clothDark = clothMaterial.clone()
  clothDark.name = 'moss-cloth-dark'
  clothDark.color.set('#74796e')
  clothDark.roughness = 0.96

  const paperMaterial = new THREE.MeshStandardMaterial({
    aoMap: paper.ao,
    aoMapIntensity: 0.24,
    bumpMap: paper.height,
    bumpScale: 0.0035,
    map: paper.albedo,
    roughness: 0.98,
    roughnessMap: paper.roughness,
    side: THREE.DoubleSide,
  })
  paperMaterial.name = 'ivory-paper'
  const paperEdge = paperMaterial.clone()
  paperEdge.name = 'ivory-paper-edge'
  paperEdge.color.set('#dfcbb2')
  paperEdge.roughness = 0.96

  const brass = new THREE.MeshPhysicalMaterial({
    clearcoat: 0.08,
    clearcoatRoughness: 0.72,
    color: SCENE_PALETTE.brass,
    envMapIntensity: 0.72,
    metalness: 0.88,
    roughness: 0.53,
  })
  brass.name = 'aged-brass'
  const brassDark = brass.clone()
  brassDark.name = 'aged-brass-cavity'
  brassDark.color.set(SCENE_PALETTE.brassDark)
  brassDark.envMapIntensity = 0.58
  brassDark.roughness = 0.67

  const ribbon = new THREE.MeshPhysicalMaterial({
    color: SCENE_PALETTE.burgundy,
    roughness: 0.9,
    sheen: 0.1,
    sheenColor: new THREE.Color('#7f3038'),
    sheenRoughness: 0.95,
    side: THREE.DoubleSide,
  })
  ribbon.name = 'burgundy-ribbon'

  const stitch = new THREE.MeshStandardMaterial({ color: '#555b4b', roughness: 0.94 })
  stitch.name = 'stitch-thread'
  const pageRule = new THREE.MeshBasicMaterial({
    color: '#b6a68f',
    depthWrite: false,
    opacity: 0.34,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    side: THREE.DoubleSide,
    transparent: true,
  })
  pageRule.name = 'page-rule-ink'
  const ground = new THREE.MeshStandardMaterial({ color: '#202a24', roughness: 1 })
  ground.name = 'shadow-ground'
  const neutral = new THREE.MeshStandardMaterial({ color: '#a9aaa3', roughness: 0.82 })
  neutral.name = 'neutral-blockout'

  const materials: THREE.Material[] = [
    walnut,
    walnutDark,
    walnutPanel,
    clothMaterial,
    clothDark,
    paperMaterial,
    paperEdge,
    brass,
    brassDark,
    ribbon,
    stitch,
    pageRule,
    ground,
    neutral,
  ]

  return {
    brass,
    brassDark,
    cloth: clothMaterial,
    clothDark,
    ground,
    neutral,
    pageRule,
    paper: paperMaterial,
    paperEdge,
    ribbon,
    stitch,
    textureCount: textures.length,
    textures,
    walnut,
    walnutDark,
    walnutPanel,
    dispose: () => {
      materials.forEach((material) => material.dispose())
      textures.forEach((texture) => texture.dispose())
    },
  }
}
