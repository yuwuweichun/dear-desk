import * as THREE from 'three'

import {
  getWallpaperTheme,
  WALLPAPER_FACE_IDS,
  type WallpaperFace,
  type WallpaperThemeId,
} from '../../domain/wallpaper-theme'
import { STUDY_ROOM_MODEL_SPEC } from './model-specs'
import {
  disposeModelGeometry,
  isPassEnabled,
  markMesh,
  measureModelResources,
  setSculptRuntime,
  type ModelFactoryOptions,
  type SculptRuntime,
} from './model-types'

export interface StudyRoomShellNodes extends Record<string, THREE.Object3D> {
  root: THREE.Group
  floor: THREE.InstancedMesh
  floorUnderlay: THREE.Mesh
  ceiling: THREE.Mesh
  ceilingTray: THREE.InstancedMesh
  ceilingCrown: THREE.InstancedMesh
  cornerPosts: THREE.Group
  walls: THREE.Group
  westWall: THREE.Mesh
  eastWall: THREE.Mesh
  northWall: THREE.Mesh
  southWall: THREE.Mesh
  northWindow: THREE.Group
  windowReveal: THREE.InstancedMesh
  windowBackdrop: THREE.Mesh
  windowGlass: THREE.Group
  baseboards: THREE.InstancedMesh
}

const ROOM_WIDTH = STUDY_ROOM_MODEL_SPEC.interior.width
const ROOM_DEPTH = STUDY_ROOM_MODEL_SPEC.interior.depth
const WEST_X = -ROOM_WIDTH / 2
const EAST_X = ROOM_WIDTH / 2
const NORTH_Z = -ROOM_DEPTH / 2
const SOUTH_Z = ROOM_DEPTH / 2

const disableRaycast = <T extends THREE.Object3D>(object: T): T => {
  object.raycast = () => undefined
  return object
}

const makeTexture = (
  name: string,
  size: number,
  colorSpace: THREE.ColorSpace,
  sample: (x: number, y: number) => [number, number, number],
) => {
  const pixels = new Uint8Array(size * size * 4)
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const offset = (y * size + x) * 4
      const value = sample(x, y)
      pixels[offset] = value[0]
      pixels[offset + 1] = value[1]
      pixels[offset + 2] = value[2]
      pixels[offset + 3] = 255
    }
  }
  const texture = new THREE.DataTexture(pixels, size, size, THREE.RGBAFormat)
  texture.name = name
  texture.colorSpace = colorSpace
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  texture.minFilter = THREE.LinearMipmapLinearFilter
  texture.magFilter = THREE.LinearFilter
  texture.generateMipmaps = true
  texture.needsUpdate = true
  return texture
}

const noise = (x: number, y: number, seed: number) => {
  const value = Math.sin(x * 12.9898 + y * 78.233 + seed * 37.719) * 43758.5453
  return value - Math.floor(value)
}

const configureWallpaperTexture = (texture: THREE.Texture, name: string) => {
  texture.name = name
  texture.colorSpace = THREE.SRGBColorSpace
  texture.wrapS = THREE.ClampToEdgeWrapping
  texture.wrapT = THREE.ClampToEdgeWrapping
  texture.minFilter = THREE.LinearMipmapLinearFilter
  texture.magFilter = THREE.LinearFilter
  texture.generateMipmaps = true
  texture.needsUpdate = true
  return texture
}

const createRoomMaterials = (wallpaperThemeId: WallpaperThemeId = 'plain') => {
  const size = STUDY_ROOM_MODEL_SPEC.textureResolution
  const wallpaperTheme = getWallpaperTheme(wallpaperThemeId)
  const createPlainWallAlbedo = () => makeTexture('study-room-wall-albedo', size, THREE.SRGBColorSpace, (x, y) => {
    const fineGrain = noise(x / size * 24, y / size * 24, 7) - 0.5
    const broadVariation = noise(x / size * 3, y / size * 3, 19) - 0.5
    const value = fineGrain * 4 + broadVariation * 6
    return [Math.round(151 + value), Math.round(147 + value), Math.round(122 + value)]
  })
  const plainWallAlbedo = createPlainWallAlbedo()
  const wallAlbedoByFace = Object.fromEntries(
    WALLPAPER_FACE_IDS.map((face) => [face, plainWallAlbedo]),
  ) as unknown as Record<WallpaperFace, THREE.Texture>
  if (wallpaperTheme.atlasPath && wallpaperTheme.atlasLayout && wallpaperTheme.atlasColumns && wallpaperTheme.atlasRows) {
    const atlas = new THREE.TextureLoader().load(wallpaperTheme.atlasPath)
    const atlasCellOrigin = wallpaperTheme.atlasCellOrigin ?? [0, 0]
    const atlasCellSize = wallpaperTheme.atlasCellSize ?? [1 / wallpaperTheme.atlasColumns!, 1 / wallpaperTheme.atlasRows!]
    const inset = 0.0015
    WALLPAPER_FACE_IDS.forEach((face) => {
      const [column, row] = wallpaperTheme.atlasLayout![face]
      const texture = configureWallpaperTexture(atlas.clone(), `study-room-wallpaper-${wallpaperThemeId}-${face}`)
      texture.repeat.set(atlasCellSize[0] - atlasCellOrigin[0] * 2 - inset * 2, atlasCellSize[1] - atlasCellOrigin[1] * 2 - inset * 2)
      texture.offset.set(column / wallpaperTheme.atlasColumns! + atlasCellOrigin[0] + inset, (wallpaperTheme.atlasRows! - row - 1) / wallpaperTheme.atlasRows! + atlasCellOrigin[1] + inset)
      wallAlbedoByFace[face] = texture
    })
    atlas.dispose()
  }
  const wallData = makeTexture('study-room-wall-data', size, THREE.NoColorSpace, (x, y) => {
    const value = Math.round(228 + (noise(x / size * 28, y / size * 28, 11) - 0.5) * 16)
    return [value, value, value]
  })
  const floorAlbedo = makeTexture('study-room-floor-albedo', size, THREE.SRGBColorSpace, (x, y) => {
    const u = x / size
    const v = y / size
    const wave = Math.sin(u * Math.PI * 22 + Math.sin(v * Math.PI * 7) * 1.3 + noise(u * 5, v * 9, 29) * 1.4)
    const fine = Math.sin(u * Math.PI * 78 + v * Math.PI * 5) * 0.5
    const grain = noise(u * 7, v * 38, 13) - 0.5
    const knotField = noise(u * 3, v * 5, 23)
    const knot = knotField > 0.82 ? (knotField - 0.82) * -70 : 0
    const tone = wave * 5 + fine * 3 + grain * 12 + knot
    return [Math.round(122 + tone), Math.round(73 + tone * 0.66), Math.round(40 + tone * 0.44)]
  })
  const floorData = makeTexture('study-room-floor-data', size, THREE.NoColorSpace, (x, y) => {
    const u = x / size
    const v = y / size
    const grain = Math.sin(u * Math.PI * 40 + Math.sin(v * Math.PI * 7)) * 9
    const value = Math.round(210 + grain + (noise(u * 18, v * 32, 17) - 0.5) * 12)
    return [value, value, value]
  })
  const outdoorAlbedo = makeTexture('study-room-window-outdoor', size, THREE.SRGBColorSpace, (x, y) => {
    const u = x / size
    const v = y / size
    const broad = Math.sin(u * Math.PI * 5 + Math.sin(v * Math.PI * 3)) * 0.5
    const foliage = (
      Math.sin(u * Math.PI * 11 + v * Math.PI * 3) +
      Math.sin(v * Math.PI * 9 - u * Math.PI * 2)
    ) * 0.25
    const skyBlend = Math.max(0, Math.min(1, (0.5 - v) * 2.4))
    const canopy = (1 - skyBlend) * (broad * 0.72 + foliage * 0.48)
    return [
      Math.round(194 + skyBlend * 43 + canopy * 25),
      Math.round(205 + skyBlend * 34 + canopy * 38),
      Math.round(155 + skyBlend * 58 + canopy * 18),
    ]
  })
  outdoorAlbedo.wrapS = THREE.ClampToEdgeWrapping
  outdoorAlbedo.wrapT = THREE.ClampToEdgeWrapping

  wallData.repeat.set(...STUDY_ROOM_MODEL_SPEC.textureRepeat.wall)
  floorAlbedo.repeat.set(...STUDY_ROOM_MODEL_SPEC.textureRepeat.floor)
  floorData.repeat.set(...STUDY_ROOM_MODEL_SPEC.textureRepeat.floor)

  const createWall = (face: WallpaperFace) => new THREE.MeshStandardMaterial({
    color: '#ffffff', map: wallAlbedoByFace[face], roughness: 0.88, roughnessMap: wallData,
    bumpMap: wallData, bumpScale: 0.012, aoMap: wallData, aoMapIntensity: 0.12,
    emissive: wallpaperTheme.atlasPath ? '#ffffff' : '#97937a',
    emissiveIntensity: wallpaperTheme.atlasPath ? 0.06 : 0.24,
    side: THREE.DoubleSide,
  })
  const wallWest = createWall('west'); wallWest.name = 'study-room-wall-paint-west'
  const wallNorth = wallpaperTheme.atlasPath ? createWall('north') : wallWest; wallNorth.name = 'study-room-wall-paint-north'
  const wallEast = wallpaperTheme.atlasPath ? createWall('east') : wallWest; wallEast.name = 'study-room-wall-paint-east'
  const wallSouth = wallpaperTheme.atlasPath ? createWall('south') : wallWest; wallSouth.name = 'study-room-wall-paint-south'
  const ceiling = new THREE.MeshBasicMaterial({ color: wallpaperTheme.atlasPath ? '#ffffff' : '#d4c6b4', map: wallpaperTheme.atlasPath ? wallAlbedoByFace.ceiling : null, side: THREE.DoubleSide })
  ceiling.name = 'study-room-ceiling-paint'
  const ceilingTray = new THREE.MeshStandardMaterial({ color: '#e6dac9', roughness: 0.82, bumpMap: wallData, bumpScale: 0.004 })
  ceilingTray.name = 'study-room-ceiling-tray-trim'
  const floor = new THREE.MeshPhysicalMaterial({
    color: '#ffffff', map: floorAlbedo, roughness: 0.58, roughnessMap: floorData,
    bumpMap: floorData, bumpScale: 0.018, aoMap: floorData, aoMapIntensity: 0.22,
    clearcoat: 0.18, clearcoatRoughness: 0.46,
  })
  floor.name = 'study-room-floor-wood'
  const floorGap = new THREE.MeshStandardMaterial({ color: '#2d190f', roughness: 0.95 })
  floorGap.name = 'study-room-floor-seam-underlay'
  const frame = new THREE.MeshStandardMaterial({
    color: '#b98b69', map: floorAlbedo, roughness: 0.58, roughnessMap: floorData,
    bumpMap: floorData, bumpScale: 0.012,
  })
  frame.name = 'study-room-window-frame'
  const baseboard = new THREE.MeshStandardMaterial({ color: '#cbb991', roughness: 0.74, bumpMap: wallData, bumpScale: 0.004 })
  baseboard.name = 'study-room-baseboard'
  const glass = new THREE.MeshPhysicalMaterial({
    color: '#e5eee7', roughness: 0.18, transmission: 0.18,
    transparent: true, opacity: 0.22, depthWrite: false,
    clearcoat: 0.35, side: THREE.DoubleSide,
  })
  glass.name = 'study-room-window-glass'
  const outdoor = new THREE.MeshBasicMaterial({ color: '#fff7d7', map: outdoorAlbedo, side: THREE.DoubleSide })
  outdoor.name = 'study-room-window-outdoor-backdrop'
  const textures = [...new Set([...Object.values(wallAlbedoByFace), wallData, floorAlbedo, floorData, outdoorAlbedo])]
  return { wall: wallNorth, wallWest, wallNorth, wallEast, wallSouth, ceiling, ceilingTray, floor, floorGap, frame, baseboard, glass, outdoor, textures }
}

const createQuad = (
  vertices: Array<[number, number, number]>,
  normal: [number, number, number],
  uv: [number, number, number, number] = [0, 0, 1, 1],
) => {
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices.flat(), 3))
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute([...normal, ...normal, ...normal, ...normal], 3))
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute([uv[0], uv[1], uv[2], uv[1], uv[2], uv[3], uv[0], uv[3]], 2))
  geometry.setIndex([0, 1, 2, 0, 2, 3])
  geometry.computeBoundingSphere()
  return geometry
}

const wallQuad = (x: number, z0: number, z1: number, y0: number, y1: number, inward: 1 | -1) =>
  inward === 1
    ? createQuad([[x, y0, z0], [x, y1, z0], [x, y1, z1], [x, y0, z1]], [1, 0, 0])
    : createQuad([[x, y0, z1], [x, y1, z1], [x, y1, z0], [x, y0, z0]], [-1, 0, 0])

const horizontalQuad = (z: number, x0: number, x1: number, y0: number, y1: number, inward: 1 | -1, uv?: [number, number, number, number]) =>
  inward === 1
    ? createQuad([[x0, y0, z], [x1, y0, z], [x1, y1, z], [x0, y1, z]], [0, 0, 1], uv)
    : createQuad([[x1, y0, z], [x0, y0, z], [x0, y1, z], [x1, y1, z]], [0, 0, -1], uv)

const createWallMesh = (geometry: THREE.BufferGeometry, material: THREE.Material, name: string, options: ModelFactoryOptions) =>
  disableRaycast(markMesh(new THREE.Mesh(geometry, material), name, { ...options, castShadow: false, receiveShadow: true }))

export function createStudyRoomShellModel(
  options: ModelFactoryOptions & { wallpaperThemeId?: WallpaperThemeId } = {},
) {
  const pass = options.pass ?? 'optimization-pass'
  const wallpaperThemeId = options.wallpaperThemeId ?? 'plain'
  const materials = createRoomMaterials(wallpaperThemeId)
  const geometries = new Set<THREE.BufferGeometry>()
  const own = <T extends THREE.BufferGeometry>(geometry: T) => { geometries.add(geometry); return geometry }
  const root = new THREE.Group()
  root.name = 'study-room-shell-model'
  root.userData = {
    modelId: 'simple-study-room-shell',
    pass,
    structure: 'four-wall-enclosed-visual-room-with-north-window',
    wallpaperThemeId,
  }

  const floorUnderlay = createWallMesh(
    own(new THREE.PlaneGeometry(ROOM_WIDTH, ROOM_DEPTH)),
    materials.floorGap,
    'study-room-floor-underlay',
    options,
  )
  floorUnderlay.rotation.x = -Math.PI / 2
  floorUnderlay.position.y = STUDY_ROOM_MODEL_SPEC.floorTopY - 0.012
  root.add(floorUnderlay)

  const plankWidth = ROOM_WIDTH / STUDY_ROOM_MODEL_SPEC.plankCount
  const plankGeometry = own(new THREE.BoxGeometry(
    1,
    STUDY_ROOM_MODEL_SPEC.plankThickness,
    1,
  ).translate(0, -STUDY_ROOM_MODEL_SPEC.plankThickness / 2, 0))
  const floor = disableRaycast(markMesh(
    new THREE.InstancedMesh(plankGeometry, materials.floor, STUDY_ROOM_MODEL_SPEC.plankCount),
    'study-room-floor',
    { ...options, castShadow: false, receiveShadow: true },
  ) as THREE.InstancedMesh)
  floor.position.y = STUDY_ROOM_MODEL_SPEC.floorTopY
  const plankMatrix = new THREE.Matrix4()
  for (let index = 0; index < STUDY_ROOM_MODEL_SPEC.plankCount; index += 1) {
    plankMatrix.compose(
      new THREE.Vector3(-ROOM_WIDTH / 2 + plankWidth * (index + 0.5), 0, 0),
      new THREE.Quaternion(),
      new THREE.Vector3(plankWidth - STUDY_ROOM_MODEL_SPEC.plankGap, 1, ROOM_DEPTH),
    )
    floor.setMatrixAt(index, plankMatrix)
    const shade = 0.88 + noise(index, 0, 53) * 0.16
    floor.setColorAt(index, new THREE.Color().setRGB(shade, shade, shade))
  }
  floor.instanceMatrix.needsUpdate = true
  if (floor.instanceColor) floor.instanceColor.needsUpdate = true
  root.add(floor)

  const ceiling = createWallMesh(
    own(new THREE.PlaneGeometry(ROOM_WIDTH, ROOM_DEPTH)),
    materials.ceiling,
    'study-room-ceiling-background-blocker',
    options,
  )
  ceiling.rotation.x = Math.PI / 2
  ceiling.position.y = STUDY_ROOM_MODEL_SPEC.wallTopY - STUDY_ROOM_MODEL_SPEC.ceilingInset
  root.add(ceiling)

  const ceilingTrayGeometry = own(new THREE.BoxGeometry(1, 1, 1))
  const ceilingTray = disableRaycast(new THREE.InstancedMesh(ceilingTrayGeometry, materials.ceilingTray, 4))
  ceilingTray.name = 'study-room-ceiling-tray'
  ceilingTray.castShadow = false
  ceilingTray.receiveShadow = true
  const ceilingY = ceiling.position.y
  const tray = STUDY_ROOM_MODEL_SPEC.ceilingTray
  const trayMatrix = new THREE.Matrix4()
  const innerDepth = ROOM_DEPTH - tray.soffitWidth * 2
  const trayY = ceilingY - tray.drop / 2
  trayMatrix.compose(new THREE.Vector3(0, trayY, -ROOM_DEPTH / 2 + tray.soffitWidth / 2), new THREE.Quaternion(), new THREE.Vector3(ROOM_WIDTH, tray.drop, tray.soffitWidth))
  ceilingTray.setMatrixAt(0, trayMatrix)
  trayMatrix.compose(new THREE.Vector3(0, trayY, ROOM_DEPTH / 2 - tray.soffitWidth / 2), new THREE.Quaternion(), new THREE.Vector3(ROOM_WIDTH, tray.drop, tray.soffitWidth))
  ceilingTray.setMatrixAt(1, trayMatrix)
  trayMatrix.compose(new THREE.Vector3(-ROOM_WIDTH / 2 + tray.soffitWidth / 2, trayY, 0), new THREE.Quaternion(), new THREE.Vector3(tray.soffitWidth, tray.drop, innerDepth))
  ceilingTray.setMatrixAt(2, trayMatrix)
  trayMatrix.compose(new THREE.Vector3(ROOM_WIDTH / 2 - tray.soffitWidth / 2, trayY, 0), new THREE.Quaternion(), new THREE.Vector3(tray.soffitWidth, tray.drop, innerDepth))
  ceilingTray.setMatrixAt(3, trayMatrix)
  ceilingTray.instanceMatrix.needsUpdate = true
  root.add(ceilingTray)

  const ceilingCrown = disableRaycast(new THREE.InstancedMesh(ceilingTrayGeometry, materials.ceilingTray, 8))
  ceilingCrown.name = 'study-room-ceiling-crown'
  ceilingCrown.castShadow = false
  ceilingCrown.receiveShadow = true
  const soffitBottomY = ceilingY - tray.drop
  const crownY = soffitBottomY - tray.crownHeight / 2
  trayMatrix.compose(new THREE.Vector3(0, crownY, NORTH_Z + tray.crownDepth / 2), new THREE.Quaternion(), new THREE.Vector3(ROOM_WIDTH, tray.crownHeight, tray.crownDepth))
  ceilingCrown.setMatrixAt(0, trayMatrix)
  trayMatrix.compose(new THREE.Vector3(0, crownY, SOUTH_Z - tray.crownDepth / 2), new THREE.Quaternion(), new THREE.Vector3(ROOM_WIDTH, tray.crownHeight, tray.crownDepth))
  ceilingCrown.setMatrixAt(1, trayMatrix)
  trayMatrix.compose(new THREE.Vector3(WEST_X + tray.crownDepth / 2, crownY, 0), new THREE.Quaternion(), new THREE.Vector3(tray.crownDepth, tray.crownHeight, ROOM_DEPTH))
  ceilingCrown.setMatrixAt(2, trayMatrix)
  trayMatrix.compose(new THREE.Vector3(EAST_X - tray.crownDepth / 2, crownY, 0), new THREE.Quaternion(), new THREE.Vector3(tray.crownDepth, tray.crownHeight, ROOM_DEPTH))
  ceilingCrown.setMatrixAt(3, trayMatrix)
  const lipY = soffitBottomY - tray.lipHeight / 2
  trayMatrix.compose(new THREE.Vector3(0, lipY, NORTH_Z + tray.lipDepth / 2), new THREE.Quaternion(), new THREE.Vector3(ROOM_WIDTH, tray.lipHeight, tray.lipDepth))
  ceilingCrown.setMatrixAt(4, trayMatrix)
  trayMatrix.compose(new THREE.Vector3(0, lipY, SOUTH_Z - tray.lipDepth / 2), new THREE.Quaternion(), new THREE.Vector3(ROOM_WIDTH, tray.lipHeight, tray.lipDepth))
  ceilingCrown.setMatrixAt(5, trayMatrix)
  trayMatrix.compose(new THREE.Vector3(WEST_X + tray.lipDepth / 2, lipY, 0), new THREE.Quaternion(), new THREE.Vector3(tray.lipDepth, tray.lipHeight, ROOM_DEPTH))
  ceilingCrown.setMatrixAt(6, trayMatrix)
  trayMatrix.compose(new THREE.Vector3(EAST_X - tray.lipDepth / 2, lipY, 0), new THREE.Quaternion(), new THREE.Vector3(tray.lipDepth, tray.lipHeight, ROOM_DEPTH))
  ceilingCrown.setMatrixAt(7, trayMatrix)
  ceilingCrown.instanceMatrix.needsUpdate = true
  root.add(ceilingCrown)

  const cornerGeometry = own(new THREE.BoxGeometry(
    STUDY_ROOM_MODEL_SPEC.wallThickness,
    STUDY_ROOM_MODEL_SPEC.wallTopY - STUDY_ROOM_MODEL_SPEC.floorTopY,
    STUDY_ROOM_MODEL_SPEC.wallThickness,
  ))
  const cornerPosts = new THREE.Group()
  cornerPosts.name = 'study-room-corner-seam-blockers'
  disableRaycast(cornerPosts)
  const cornerOffsetX = ROOM_WIDTH / 2 - STUDY_ROOM_MODEL_SPEC.wallThickness / 2
  const cornerOffsetZ = ROOM_DEPTH / 2 - STUDY_ROOM_MODEL_SPEC.wallThickness / 2
  for (const [x, z, name] of [
    [-cornerOffsetX, -cornerOffsetZ, 'north-west'],
    [cornerOffsetX, -cornerOffsetZ, 'north-east'],
    [cornerOffsetX, cornerOffsetZ, 'south-east'],
    [-cornerOffsetX, cornerOffsetZ, 'south-west'],
  ] as const) {
    const post = disableRaycast(markMesh(new THREE.Mesh(cornerGeometry, materials.wallNorth), `study-room-corner-${name}`, options))
    post.position.set(x, (STUDY_ROOM_MODEL_SPEC.floorTopY + STUDY_ROOM_MODEL_SPEC.wallTopY) / 2, z)
    cornerPosts.add(post)
  }
  root.add(cornerPosts)

  const walls = new THREE.Group(); walls.name = 'study-room-walls'; disableRaycast(walls)
  const window = STUDY_ROOM_MODEL_SPEC.window
  const wx0 = window.centerX - window.width / 2
  const wx1 = window.centerX + window.width / 2
  const northWallU = (x: number) => (x - WEST_X) / ROOM_WIDTH
  const northWallV = (y: number) => (y - STUDY_ROOM_MODEL_SPEC.floorTopY) / (STUDY_ROOM_MODEL_SPEC.wallTopY - STUDY_ROOM_MODEL_SPEC.floorTopY)
  const west = createWallMesh(own(wallQuad(WEST_X, NORTH_Z, SOUTH_Z, STUDY_ROOM_MODEL_SPEC.floorTopY, STUDY_ROOM_MODEL_SPEC.wallTopY, 1)), materials.wallWest, 'study-room-west-wall', options)
  const east = createWallMesh(own(wallQuad(EAST_X, SOUTH_Z, NORTH_Z, STUDY_ROOM_MODEL_SPEC.floorTopY, STUDY_ROOM_MODEL_SPEC.wallTopY, -1)), materials.wallEast, 'study-room-east-wall', options)
  const south = createWallMesh(own(horizontalQuad(SOUTH_Z, EAST_X, WEST_X, STUDY_ROOM_MODEL_SPEC.floorTopY, STUDY_ROOM_MODEL_SPEC.wallTopY, -1)), materials.wallSouth, 'study-room-south-wall', options)
  const northWindowParts = [
    horizontalQuad(NORTH_Z, WEST_X, wx0, STUDY_ROOM_MODEL_SPEC.floorTopY, STUDY_ROOM_MODEL_SPEC.wallTopY, 1, [northWallU(WEST_X), 0, northWallU(wx0), 1]),
    horizontalQuad(NORTH_Z, wx1, EAST_X, STUDY_ROOM_MODEL_SPEC.floorTopY, STUDY_ROOM_MODEL_SPEC.wallTopY, 1, [northWallU(wx1), 0, northWallU(EAST_X), 1]),
    horizontalQuad(NORTH_Z, wx0, wx1, STUDY_ROOM_MODEL_SPEC.floorTopY, window.bottomY, 1, [northWallU(wx0), 0, northWallU(wx1), northWallV(window.bottomY)]),
    horizontalQuad(NORTH_Z, wx0, wx1, window.topY, STUDY_ROOM_MODEL_SPEC.wallTopY, 1, [northWallU(wx0), northWallV(window.topY), northWallU(wx1), 1]),
  ]
  const northWindowWall = new THREE.Group(); northWindowWall.name = 'study-room-north-wall'; disableRaycast(northWindowWall)
  northWindowParts.forEach((geometry, index) => northWindowWall.add(createWallMesh(own(geometry), materials.wallNorth, `study-room-north-wall-panel-${index + 1}`, options)))
  walls.add(west, northWindowWall, east, south); root.add(walls)

  const northWindow = new THREE.Group(); northWindow.name = 'study-room-north-window'; northWindow.position.set(0, 0, NORTH_Z); northWindow.rotation.y = -Math.PI / 2; disableRaycast(northWindow)
  const frameDepth = window.frameDepth
  const frameWidth = window.frameWidth
  const windowHeight = window.topY - window.bottomY
  const windowCenterY = (window.bottomY + window.topY) / 2
  const frameOpeningWidth = window.width - window.revealThickness * 2
  const frameOpeningHeight = windowHeight - window.revealThickness * 2
  const windowReveal = disableRaycast(new THREE.InstancedMesh(ceilingTrayGeometry, materials.wallNorth, 4))
  windowReveal.name = 'study-room-window-reveal'
  windowReveal.castShadow = false
  windowReveal.receiveShadow = true
  const revealMatrix = new THREE.Matrix4()
  const revealX = -window.revealDepth / 2
  revealMatrix.compose(new THREE.Vector3(revealX, windowCenterY, -window.width / 2 + window.revealThickness / 2), new THREE.Quaternion(), new THREE.Vector3(window.revealDepth, windowHeight, window.revealThickness))
  windowReveal.setMatrixAt(0, revealMatrix)
  revealMatrix.compose(new THREE.Vector3(revealX, windowCenterY, window.width / 2 - window.revealThickness / 2), new THREE.Quaternion(), new THREE.Vector3(window.revealDepth, windowHeight, window.revealThickness))
  windowReveal.setMatrixAt(1, revealMatrix)
  revealMatrix.compose(new THREE.Vector3(revealX, window.bottomY + window.revealThickness / 2, 0), new THREE.Quaternion(), new THREE.Vector3(window.revealDepth, window.revealThickness, window.width - window.revealThickness * 2))
  windowReveal.setMatrixAt(2, revealMatrix)
  revealMatrix.compose(new THREE.Vector3(revealX, window.topY - window.revealThickness / 2, 0), new THREE.Quaternion(), new THREE.Vector3(window.revealDepth, window.revealThickness, window.width - window.revealThickness * 2))
  windowReveal.setMatrixAt(3, revealMatrix)
  windowReveal.instanceMatrix.needsUpdate = true
  northWindow.add(windowReveal)
  const frameGeometry = own(new THREE.BoxGeometry(frameDepth, 1, 1))
  const addFrame = (name: string, position: [number, number, number], scale: [number, number, number]) => {
    const mesh = disableRaycast(markMesh(new THREE.Mesh(frameGeometry, materials.frame), name, options))
    mesh.position.set(...position); mesh.scale.set(...scale); northWindow.add(mesh); return mesh
  }
  addFrame('study-room-window-frame-left', [-window.frameInset, windowCenterY, -frameOpeningWidth / 2 + frameWidth / 2], [1, frameOpeningHeight, frameWidth])
  addFrame('study-room-window-frame-right', [-window.frameInset, windowCenterY, frameOpeningWidth / 2 - frameWidth / 2], [1, frameOpeningHeight, frameWidth])
  addFrame('study-room-window-frame-top', [-window.frameInset, window.topY - window.revealThickness - frameWidth / 2, 0], [1, frameWidth, frameOpeningWidth])
  addFrame('study-room-window-frame-bottom', [-window.frameInset, window.bottomY + window.revealThickness + frameWidth / 2, 0], [1, frameWidth, frameOpeningWidth])
  addFrame('study-room-window-mullion-vertical', [-window.frameInset, windowCenterY, 0], [1, frameOpeningHeight - frameWidth * 2, window.mullionWidth])
  addFrame('study-room-window-mullion-horizontal', [-window.frameInset, windowCenterY, 0], [1, window.mullionWidth, frameOpeningWidth - frameWidth * 2])
  const windowBackdrop = disableRaycast(markMesh(
    new THREE.Mesh(own(new THREE.PlaneGeometry(window.width, window.topY - window.bottomY)), materials.outdoor),
    'study-room-window-outdoor-backdrop',
    options,
  ))
  windowBackdrop.rotation.y = Math.PI / 2
  windowBackdrop.position.set(-window.frameInset - frameDepth / 2 - 0.02, windowCenterY, 0)
  northWindow.add(windowBackdrop)
  const paneWidth = (frameOpeningWidth - window.mullionWidth - frameWidth * 2) / 2
  const paneHeight = (frameOpeningHeight - window.mullionWidth - frameWidth * 2) / 2
  const paneGeometry = own(new THREE.PlaneGeometry(paneWidth, paneHeight))
  const glassGroup = new THREE.Group(); glassGroup.name = 'study-room-window-glass'; disableRaycast(glassGroup)
  for (let row = 0; row < 2; row += 1) for (let column = 0; column < 2; column += 1) {
    const pane = disableRaycast(markMesh(new THREE.Mesh(paneGeometry, materials.glass), `study-room-window-pane-${row * 2 + column + 1}`, options))
    pane.rotation.y = Math.PI / 2
    pane.position.set(-window.frameInset + frameDepth / 2 - 0.015, window.bottomY + window.revealThickness + frameWidth + paneHeight / 2 + row * (paneHeight + window.mullionWidth), -frameOpeningWidth / 2 + frameWidth + paneWidth / 2 + column * (paneWidth + window.mullionWidth))
    glassGroup.add(pane)
  }
  northWindow.add(glassGroup); root.add(northWindow)

  const baseboardGeometry = own(new THREE.BoxGeometry(1, 1, 1))
  const baseboards = disableRaycast(new THREE.InstancedMesh(baseboardGeometry, materials.baseboard, 8))
  baseboards.name = 'study-room-baseboards'
  const matrix = new THREE.Matrix4()
  const base = STUDY_ROOM_MODEL_SPEC.baseboard
  matrix.compose(new THREE.Vector3(WEST_X + base.inset, STUDY_ROOM_MODEL_SPEC.floorTopY + base.height / 2, 0), new THREE.Quaternion(), new THREE.Vector3(base.depth, base.height, ROOM_DEPTH))
  baseboards.setMatrixAt(0, matrix)
  matrix.compose(new THREE.Vector3(EAST_X - base.inset, STUDY_ROOM_MODEL_SPEC.floorTopY + base.height / 2, 0), new THREE.Quaternion(), new THREE.Vector3(base.depth, base.height, ROOM_DEPTH)); baseboards.setMatrixAt(1, matrix)
  matrix.compose(new THREE.Vector3(0, STUDY_ROOM_MODEL_SPEC.floorTopY + base.height / 2, NORTH_Z + base.inset), new THREE.Quaternion(), new THREE.Vector3(ROOM_WIDTH, base.height, base.depth)); baseboards.setMatrixAt(2, matrix)
  matrix.compose(new THREE.Vector3(0, STUDY_ROOM_MODEL_SPEC.floorTopY + base.height / 2, SOUTH_Z - base.inset), new THREE.Quaternion(), new THREE.Vector3(ROOM_WIDTH, base.height, base.depth)); baseboards.setMatrixAt(3, matrix)
  const capY = STUDY_ROOM_MODEL_SPEC.floorTopY + base.height - base.capHeight / 2
  matrix.compose(new THREE.Vector3(WEST_X + base.capInset, capY, 0), new THREE.Quaternion(), new THREE.Vector3(base.depth * 0.72, base.capHeight, ROOM_DEPTH)); baseboards.setMatrixAt(4, matrix)
  matrix.compose(new THREE.Vector3(EAST_X - base.capInset, capY, 0), new THREE.Quaternion(), new THREE.Vector3(base.depth * 0.72, base.capHeight, ROOM_DEPTH)); baseboards.setMatrixAt(5, matrix)
  matrix.compose(new THREE.Vector3(0, capY, NORTH_Z + base.capInset), new THREE.Quaternion(), new THREE.Vector3(ROOM_WIDTH, base.capHeight, base.depth * 0.72)); baseboards.setMatrixAt(6, matrix)
  matrix.compose(new THREE.Vector3(0, capY, SOUTH_Z - base.capInset), new THREE.Quaternion(), new THREE.Vector3(ROOM_WIDTH, base.capHeight, base.depth * 0.72)); baseboards.setMatrixAt(7, matrix)
  baseboards.instanceMatrix.needsUpdate = true; root.add(baseboards)

  const nodes = { root, floor, floorUnderlay, ceiling, ceilingTray, ceilingCrown, cornerPosts, walls, westWall: west, eastWall: east, northWall: northWindowWall.children[0] as THREE.Mesh, southWall: south, northWindow, windowReveal, windowBackdrop, windowGlass: glassGroup, baseboards } satisfies StudyRoomShellNodes
  setSculptRuntime(root, { colliders: { floor: { id: 'study-room-floor', type: 'box', center: [0, STUDY_ROOM_MODEL_SPEC.floorTopY, 0], size: [ROOM_WIDTH, 0.02, ROOM_DEPTH] } }, destructionGroups: { walls: [...walls.children], window: [northWindow], glass: [...glassGroup.children] }, nodes, sockets: { floor, northWindow } } satisfies SculptRuntime<StudyRoomShellNodes>)
  root.userData.resourceMetrics = measureModelResources(root)
  root.userData.resourceBudget = { targetTriangles: 250000, maxDrawCalls: 160, textures: materials.textures.length }
  root.userData.dispose = () => { disposeModelGeometry(root); geometries.clear(); Object.values(materials).forEach((value) => { if (value instanceof THREE.Material) value.dispose() }); materials.textures.forEach((texture) => texture.dispose()) }
  root.userData.passLayers = { blockout: true, structural: isPassEnabled(pass, 'structural-pass'), form: isPassEnabled(pass, 'form-refinement'), material: isPassEnabled(pass, 'material-pass'), interaction: isPassEnabled(pass, 'interaction-pass'), optimization: isPassEnabled(pass, 'optimization-pass') }
  return root
}
