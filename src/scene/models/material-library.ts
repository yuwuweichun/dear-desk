import * as THREE from 'three'

export const SCENE_MATERIAL_VERSION = 'V2.0' as const
export const DEFAULT_SCENE_PALETTE_VERSION = 'v2' as const

export const SCENE_PALETTE_PRESETS = {
  v1: {
    background: '#dce4e0',
    mint: '#78958a',
    mintDark: '#526f65',
    wood: '#ad927c',
    woodDark: '#705e50',
    woodPanel: '#bca28b',
  },
  v2: {
    background: '#d5dad8',
    mint: '#73858a',
    mintDark: '#4c5e63',
    wood: '#73411f',
    woodDark: '#593219',
    woodPanel: '#70401f',
  },
  v3: {
    background: '#d8dee2',
    mint: '#536b7b',
    mintDark: '#344b59',
    wood: '#a9794f',
    woodDark: '#654832',
    woodPanel: '#bf9268',
  },
  v4: {
    background: '#ddd8d2',
    mint: '#8a5d59',
    mintDark: '#603f3c',
    wood: '#856047',
    woodDark: '#573e31',
    woodPanel: '#a77b5c',
  },
  v5: {
    background: '#d3d5d5',
    mint: '#5c6263',
    mintDark: '#3b4142',
    wood: '#9a6c46',
    woodDark: '#59402f',
    woodPanel: '#b5845c',
  },
  v6: {
    background: '#ddd9de',
    mint: '#71697a',
    mintDark: '#4e4857',
    wood: '#89634d',
    woodDark: '#503a2f',
    woodPanel: '#a77e66',
  },
  v7: {
    background: '#d9d8d1',
    mint: '#9a8354',
    mintDark: '#6d5c38',
    wood: '#795640',
    woodDark: '#463228',
    woodPanel: '#956e54',
  },
  v8: {
    background: '#d7dadd',
    mint: '#596d82',
    mintDark: '#3d5064',
    wood: '#a4866b',
    woodDark: '#625044',
    woodPanel: '#b99a7e',
  },
  v9: {
    background: '#dad6d2',
    mint: '#985f4f',
    mintDark: '#693f35',
    wood: '#805943',
    woodDark: '#4b352a',
    woodPanel: '#9b7057',
  },
  v10: {
    background: '#d5d7d7',
    mint: '#4f5555',
    mintDark: '#303535',
    wood: '#8b6548',
    woodDark: '#49372b',
    woodPanel: '#a67e5d',
  },
} as const

export type ScenePaletteVersion = keyof typeof SCENE_PALETTE_PRESETS
export type ScenePalettePreset = (typeof SCENE_PALETTE_PRESETS)[ScenePaletteVersion]

const SCENE_PALETTE_FIXED = {
  coral: '#ee7771',
  coralDark: '#c95757',
  mintSoft: '#83d9c8',
  notebookCover: '#173f35',
  notebookCoverDark: '#0e2d27',
  paper: '#fffbe7',
  paperEdge: '#e6dcc4',
  shadow: '#5e766f',
} as const

export type ScenePalette = ScenePalettePreset & typeof SCENE_PALETTE_FIXED

export interface SceneColorConfig {
  background: string
  deskFrame: string
  deskInset: string
  deskLegs: string
  deskTop: string
  matBinding: string
  matField: string
  notebookCover: string
  notebookJoint: string
}

export const getScenePalette = (version: ScenePaletteVersion): ScenePalette => ({
  ...SCENE_PALETTE_FIXED,
  ...SCENE_PALETTE_PRESETS[version],
})

export const SCENE_PALETTE = getScenePalette(DEFAULT_SCENE_PALETTE_VERSION)

export const getSceneColorConfig = (
  palette: ScenePalette = SCENE_PALETTE,
): SceneColorConfig => ({
  background: palette.background,
  deskFrame: palette.woodDark,
  deskInset: palette.woodPanel,
  deskLegs: palette.woodDark,
  deskTop: palette.wood,
  matBinding: palette.mintDark,
  matField: palette.mint,
  notebookCover: palette.notebookCover,
  notebookJoint: palette.notebookCoverDark,
})

export const resolveScenePaletteVersion = (
  search: string,
  development: boolean,
): ScenePaletteVersion => {
  if (!development) return DEFAULT_SCENE_PALETTE_VERSION
  const requested = new URLSearchParams(search).get('palette')?.toLowerCase()
  return requested && requested in SCENE_PALETTE_PRESETS
    ? requested as ScenePaletteVersion
    : DEFAULT_SCENE_PALETTE_VERSION
}

export type SurfaceFamily = 'cloth' | 'kraft' | 'paper' | 'wood'
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
  notebookCover: THREE.MeshPhysicalMaterial
  notebookCoverDark: THREE.MeshPhysicalMaterial
  notebookCoverEdge: THREE.MeshPhysicalMaterial
  neutral: THREE.MeshStandardMaterial
  paper: THREE.MeshStandardMaterial
  paperBlock: THREE.MeshStandardMaterial
  paperEdge: THREE.MeshStandardMaterial
  stitch: THREE.MeshStandardMaterial
  textureCount: number
  textures: THREE.Texture[]
  walnut: THREE.MeshPhysicalMaterial
  walnutDark: THREE.MeshPhysicalMaterial
  walnutDrawer: THREE.MeshPhysicalMaterial
  walnutLegs: THREE.MeshPhysicalMaterial
  walnutPanel: THREE.MeshPhysicalMaterial
  dispose: () => void
}

export const applySceneColors = (
  materials: ModelMaterialLibrary,
  colors: SceneColorConfig,
) => {
  materials.walnut.color.set(colors.deskTop)
  materials.walnutDark.color.set(colors.deskFrame)
  materials.walnutDrawer.color.set(colors.deskInset).multiplyScalar(0.78)
  materials.walnutLegs.color.set(colors.deskLegs)
  materials.walnutPanel.color.set(colors.deskInset)
  materials.cloth.color.set(colors.matField)
  materials.clothDark.color.set(colors.matBinding)
  materials.notebookCover.color.set(colors.notebookCover)
  materials.notebookCoverDark.color.set(colors.notebookJoint)
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
      (periodicNoise2d(u, v, 2, 3, 101) - 0.5) * 0.105 +
      (periodicNoise2d(u, v, 4, 5, 103) - 0.5) * 0.045
    const waviness =
      Math.sin((u * 3 + periodicNoise1d(v, 3, 105)) * Math.PI * 2) * 0.012
    const grainCoordinate = v + flow + waviness
    const macro = periodicNoise1d(grainCoordinate, 5, 107)
    const meso = periodicNoise1d(grainCoordinate, 17, 109)
    const micro = periodicNoise1d(grainCoordinate, 53, 113)
    const fine = periodicNoise1d(grainCoordinate + (macro - 0.5) * 0.012, 97, 127)
    const pore = Math.max(0, 0.16 - micro) / 0.16
    const grain =
      (macro - 0.5) * 0.38 +
      (meso - 0.5) * 0.78 +
      (micro - 0.5) * 0.34 +
      (fine - 0.5) * 0.18
    const streak = periodicNoise2d(u + flow, v, 19, 7, 131) - 0.5
    const value = grain * 32 + streak * 7 - pore * 5
    const albedo = clampByte(232 + value)
    return {
      albedo: [albedo, albedo, albedo],
      ao: clampByte(236 + (macro - 0.5) * 15 - pore * 18),
      height: clampByte(
        128 + (macro - 0.5) * 11 + (meso - 0.5) * 20 + (micro - 0.5) * 8 - pore * 7,
      ),
      roughness: clampByte(
        224 - (macro - 0.5) * 17 + (meso - 0.5) * 22 + pore * 13,
      ),
    }
  }

  if (family === 'cloth') {
    const macro = periodicNoise2d(u, v, 3, 3, 41)
    const yarn = periodicNoise2d(u, v, 17, 15, 43)
    const warpCount = Math.max(4, Math.round(size / 12))
    const weftCount = Math.max(4, Math.round(size / 14))
    const warp = threadRidge(u * warpCount + v * 1.7)
    const weft = threadRidge(v * weftCount - u * 1.3)
    const weave = (warp - 0.23) * 0.58 + (weft - 0.23) * 0.42
    const interstice = 1 - Math.min(1, warp * 0.56 + weft * 0.44)
    const value = (macro - 0.5) * 3 + (yarn - 0.5) * 1.4 + weave * 0.72
    const albedo = clampByte(247 + value)
    return {
      albedo: [albedo, albedo, albedo],
      ao: clampByte(243 - interstice * 8 + (macro - 0.5) * 3),
      height: clampByte(
        126 + warp * 10 + weft * 8 + (yarn - 0.5) * 3,
      ),
      roughness: clampByte(
        232 + interstice * 7 + (macro - 0.5) * 4 - warp * 2,
      ),
    }
  }

  if (family === 'kraft') {
    const macro = periodicNoise2d(u, v, 3, 3, 131)
    const pulp = periodicNoise2d(u, v, 17, 15, 137)
    const longFiber = periodicNoise1d(v + u * 0.08, 83, 139)
    const crossFiber = periodicNoise1d(u - v * 0.05, 59, 149)
    const fiber =
      (longFiber - 0.5) * 0.72 +
      (crossFiber - 0.5) * 0.28
    const value = (macro - 0.5) * 5 + (pulp - 0.5) * 3 + fiber * 3
    return {
      albedo: [
        clampByte(232 + value * 0.64),
        clampByte(226 + value * 0.56),
        clampByte(207 + value * 0.42),
      ],
      ao: clampByte(244 + (macro - 0.5) * 5 - Math.abs(fiber) * 4),
      height: clampByte(128 + fiber * 10 + (pulp - 0.5) * 5),
      roughness: clampByte(242 - fiber * 5 + (pulp - 0.5) * 5),
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
      clampByte(255 + value * 0.32),
      clampByte(251 + value * 0.28),
      clampByte(231 + value * 0.22),
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
  options: {
    anisotropy?: number
    palette?: ScenePalette
    sceneColors?: SceneColorConfig
    textureSize?: number
  } = {},
): ModelMaterialLibrary {
  const size = options.textureSize ?? 1024
  const anisotropy = options.anisotropy ?? 8
  const palette = options.palette ?? SCENE_PALETTE
  const sceneColors = options.sceneColors ?? getSceneColorConfig(palette)
  const wood = createTextureSet('wood', size, anisotropy)
  const cloth = createTextureSet('cloth', size, anisotropy)
  const kraft = createTextureSet('kraft', size, anisotropy)
  const paper = createTextureSet('paper', size, anisotropy)
  const textures = [
    ...Object.values(wood),
    ...Object.values(cloth),
    ...Object.values(kraft),
    ...Object.values(paper),
  ]

  const walnut = new THREE.MeshPhysicalMaterial({
    aoMap: wood.ao,
    aoMapIntensity: 0.26,
    bumpMap: wood.height,
    bumpScale: 0.0042,
    clearcoat: 0.16,
    clearcoatRoughness: 0.58,
    color: sceneColors.deskTop,
    map: wood.albedo,
    roughness: 0.62,
    roughnessMap: wood.roughness,
  })
  walnut.name = 'animal-desk-wood-top'
  const walnutDark = walnut.clone()
  walnutDark.name = 'animal-desk-wood-frame'
  walnutDark.color.set(sceneColors.deskFrame)
  walnutDark.roughness = 0.68
  const walnutLegs = walnutDark.clone()
  walnutLegs.name = 'animal-desk-wood-legs'
  walnutLegs.color.set(sceneColors.deskLegs)
  walnutLegs.roughness = 0.66
  const walnutPanel = walnut.clone()
  walnutPanel.name = 'animal-desk-wood-panel'
  walnutPanel.color.set(sceneColors.deskInset)
  walnutPanel.roughness = 0.64
  const walnutDrawer = walnutPanel.clone()
  walnutDrawer.name = 'warm-paper-desk-drawer-front'
  walnutDrawer.color.multiplyScalar(0.78)
  walnutDrawer.roughness = 0.62

  const clothMaterial = new THREE.MeshPhysicalMaterial({
    aoMap: cloth.ao,
    aoMapIntensity: 0.18,
    anisotropy: 0.18,
    anisotropyRotation: Math.PI / 2,
    bumpMap: cloth.height,
    bumpScale: 0.0032,
    color: sceneColors.matField,
    map: cloth.albedo,
    roughness: 0.95,
    roughnessMap: cloth.roughness,
    sheen: 0.08,
    sheenColor: new THREE.Color('#aebdc0'),
    sheenRoughness: 0.95,
  })
  clothMaterial.name = 'animal-mint-cloth'
  const clothDark = clothMaterial.clone()
  clothDark.name = 'animal-mint-cloth-dark'
  clothDark.bumpScale = 0.002
  clothDark.color.set(sceneColors.matBinding)
  clothDark.roughness = 0.9
  clothDark.sheen = 0.06

  const notebookCover = new THREE.MeshPhysicalMaterial({
    aoMap: cloth.ao,
    aoMapIntensity: 0.9,
    anisotropy: 0.05,
    anisotropyRotation: Math.PI / 2,
    bumpMap: cloth.height,
    bumpScale: 0.008,
    color: sceneColors.notebookCover,
    map: cloth.albedo,
    roughness: 0.94,
    roughnessMap: cloth.roughness,
    sheen: 0.04,
    sheenColor: new THREE.Color('#87978d'),
    sheenRoughness: 0.98,
  })
  notebookCover.name = 'ink-green-cloth-cover'
  const notebookCoverDark = notebookCover.clone()
  notebookCoverDark.name = 'ink-green-kraft-cover-dark'
  notebookCoverDark.color.set(sceneColors.notebookJoint)
  notebookCoverDark.roughness = 0.98
  const notebookCoverEdge = notebookCover.clone()
  notebookCoverEdge.name = 'ink-green-cover-edge-low-spec'
  notebookCoverEdge.roughness = 0.985
  notebookCoverEdge.anisotropy = 0
  notebookCoverEdge.sheen = 0.012
  notebookCoverEdge.sheenRoughness = 1

  const paperMaterial = new THREE.MeshStandardMaterial({
    aoMap: paper.ao,
    aoMapIntensity: 0.12,
    bumpMap: paper.height,
    bumpScale: 0.0018,
    color: '#f6efdc',
    map: paper.albedo,
    roughness: 0.98,
    roughnessMap: paper.roughness,
    side: THREE.DoubleSide,
  })
  paperMaterial.name = 'animal-warm-paper'
  const paperEdge = paperMaterial.clone()
  paperEdge.name = 'animal-warm-paper-edge'
  paperEdge.color.set('#d8ccb0')
  paperEdge.roughness = 0.98
  const paperBlock = paperEdge.clone()
  paperBlock.name = 'animal-warm-paper-block'
  paperBlock.color.set('#b9aa8b')
  paperBlock.aoMapIntensity = 0.04
  paperBlock.roughness = 0.99

  const brass = new THREE.MeshPhysicalMaterial({
    clearcoat: 0.12,
    clearcoatRoughness: 0.2,
    color: '#8f6a41',
    envMapIntensity: 0.82,
    metalness: 0.92,
    roughness: 0.34,
  })
  brass.name = 'aged-brass-crown'
  const brassDark = brass.clone()
  brassDark.name = 'aged-brass-neck'
  brassDark.color.set('#59462f')
  brassDark.envMapIntensity = 0.7
  brassDark.roughness = 0.52

  const stitch = new THREE.MeshStandardMaterial({ color: '#aab5b4', roughness: 0.88 })
  stitch.name = 'stitch-thread'
  const neutral = new THREE.MeshStandardMaterial({ color: '#d8ded9', roughness: 0.82 })
  neutral.name = 'neutral-blockout'

  const materials: THREE.Material[] = [
    walnut,
    walnutDark,
    walnutDrawer,
    walnutLegs,
    walnutPanel,
    clothMaterial,
    clothDark,
    notebookCover,
    notebookCoverDark,
    notebookCoverEdge,
    paperMaterial,
    paperBlock,
    paperEdge,
    brass,
    brassDark,
    stitch,
    neutral,
  ]

  return {
    brass,
    brassDark,
    cloth: clothMaterial,
    clothDark,
    notebookCover,
    notebookCoverDark,
    notebookCoverEdge,
    neutral,
    paper: paperMaterial,
    paperBlock,
    paperEdge,
    stitch,
    textureCount: textures.length,
    textures,
    walnut,
    walnutDark,
    walnutDrawer,
    walnutLegs,
    walnutPanel,
    dispose: () => {
      materials.forEach((material) => material.dispose())
      textures.forEach((texture) => texture.dispose())
    },
  }
}
