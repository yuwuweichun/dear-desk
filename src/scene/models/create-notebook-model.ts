import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'

import {
  createCurvedPageGeometry,
  createRibbonGeometry,
  createRoundedPlateGeometry,
  scaleGeometryUvs,
} from './geometry'
import type { ModelMaterialLibrary } from './material-library'
import { MODEL_LIMITS, NOTEBOOK_MODEL_SPEC } from './model-specs'
import {
  disposeModelGeometry,
  isPassEnabled,
  markMesh,
  measureModelResources,
  setSculptRuntime,
  type ModelFactoryOptions,
} from './model-types'

export interface NotebookModelNodes
  extends Record<string, THREE.Object3D> {
  backCover: THREE.Group
  coverPivot: THREE.Group
  frontCover: THREE.Group
  gutter: THREE.Group
  leftPageEdges: THREE.InstancedMesh
  leftPageRules: THREE.InstancedMesh
  leftPages: THREE.Group
  leftTopPage: THREE.Mesh
  nameplate: THREE.Group
  rightPageEdges: THREE.InstancedMesh
  rightPageRules: THREE.InstancedMesh
  rightPages: THREE.Group
  rightTopPage: THREE.Mesh
  ribbon: THREE.Group
  rivets: THREE.InstancedMesh
  root: THREE.Group
  spine: THREE.Group
}

type PageSide = 'left' | 'right'

const PAGE_EDGE_LAYERS = 9
const PAGE_RULE_COUNT = 7
const CLOSED_RIGHT_PAGE_Y = 0.14
const OPEN_RIGHT_PAGE_Y = 0.3
const CLOSED_LEFT_PAGE_Y = -0.14
const OPEN_LEFT_PAGE_Y = -0.005
const CLOSED_RIBBON_X = 0.08
const OPEN_RIBBON_X = NOTEBOOK_MODEL_SPEC.ribbon.worldX
const RIBBON_FORE_EDGE_START = 0.8

const addSecondaryUv = <T extends THREE.BufferGeometry>(geometry: T) => {
  const uv = geometry.getAttribute('uv')
  if (uv && !geometry.getAttribute('uv1')) geometry.setAttribute('uv1', uv.clone())
  return geometry
}

const finishMesh = <T extends THREE.Mesh>(
  mesh: T,
  name: string,
  options: ModelFactoryOptions,
  shadows = true,
) => {
  markMesh(mesh, name, options)
  if (!shadows) {
    mesh.castShadow = false
    mesh.receiveShadow = false
  }
  return mesh
}

const materialFor = (
  enabled: boolean,
  detailed: THREE.Material,
  materials: ModelMaterialLibrary,
) => (enabled ? detailed : materials.neutral)

const mergeAndDispose = (geometries: THREE.BufferGeometry[]) => {
  const merged = mergeGeometries(geometries)
  geometries.forEach((geometry) => geometry.dispose())
  if (!merged) throw new Error('Could not batch notebook geometry')
  return merged
}

function createCover(
  id: 'front-cover' | 'back-cover',
  outward: -1 | 1,
  width: number,
  materials: ModelMaterialLibrary,
  usePbr: boolean,
  options: ModelFactoryOptions,
) {
  const cover = new THREE.Group()
  cover.name = id

  const shellGeometry = addSecondaryUv(
    scaleGeometryUvs(
      createRoundedPlateGeometry(
        width,
        NOTEBOOK_MODEL_SPEC.cover.depth,
        NOTEBOOK_MODEL_SPEC.cover.thickness,
        NOTEBOOK_MODEL_SPEC.cover.planRadius,
        0.026,
      ),
      5.2,
      6.4,
    ),
  )
  const coreGeometry = addSecondaryUv(
    createRoundedPlateGeometry(
      width - 0.1,
      NOTEBOOK_MODEL_SPEC.cover.depth - 0.12,
      NOTEBOOK_MODEL_SPEC.cover.thickness * 0.7,
      NOTEBOOK_MODEL_SPEC.cover.planRadius - 0.035,
      0.012,
    ),
  )
  const linerGeometry = addSecondaryUv(
    scaleGeometryUvs(
      createRoundedPlateGeometry(
        width - 0.16,
        NOTEBOOK_MODEL_SPEC.cover.depth - 0.2,
        0.018,
        NOTEBOOK_MODEL_SPEC.cover.planRadius - 0.05,
        0.005,
      ),
      5,
      6,
    ),
  )

  const shell = finishMesh(
    new THREE.Mesh(shellGeometry, materialFor(usePbr, materials.cloth, materials)),
    `${id}-cloth-shell`,
    options,
  )
  const linerOffset =
    outward * (NOTEBOOK_MODEL_SPEC.cover.thickness / 2 + 0.006)
  linerGeometry.translate(0, linerOffset, 0)
  const boardAndLiner = finishMesh(
    new THREE.Mesh(
      mergeAndDispose([coreGeometry, linerGeometry]),
      materialFor(usePbr, materials.clothDark, materials),
    ),
    `${id}-board-core-and-inner-liner`,
    options,
  )
  boardAndLiner.userData = {
    componentIds: [`${id}-board-core`, `${id}-inner-liner`],
    linerOffset,
    role: 'book-board-core-and-inner-liner',
  }
  shell.userData.planRadius = NOTEBOOK_MODEL_SPEC.cover.planRadius
  cover.add(shell, boardAndLiner)
  return cover
}

function createPageEdgeInstances(
  side: PageSide,
  materials: ModelMaterialLibrary,
  usePbr: boolean,
  options: ModelFactoryOptions,
) {
  const geometry = addSecondaryUv(new THREE.BoxGeometry(1, 0.006, 0.018))
  const mesh = new THREE.InstancedMesh(
    geometry,
    materialFor(usePbr, materials.paperEdge, materials),
    PAGE_EDGE_LAYERS * 2,
  )
  const dummy = new THREE.Object3D()
  const baseColor = new THREE.Color('#d4c19f')
  const warmColor = new THREE.Color('#bca581')
  const page = NOTEBOOK_MODEL_SPEC.page

  for (let index = 0; index < PAGE_EDGE_LAYERS; index += 1) {
    const t = index / Math.max(1, PAGE_EDGE_LAYERS - 1)
    const y = -page.stackThickness / 2 + 0.012 + t * (page.stackThickness - 0.024)
    const inset = Math.sin((index + 1) * 2.17) * 0.012
    dummy.position.set(inset, y, page.depth / 2 - 0.014)
    dummy.rotation.set(0, 0, 0)
    dummy.scale.set(page.width * (0.94 - index * 0.002), 1, 1)
    dummy.updateMatrix()
    mesh.setMatrixAt(index, dummy.matrix)

    dummy.position.set(page.width / 2 - 0.014, y, inset)
    dummy.rotation.set(0, Math.PI / 2, 0)
    dummy.scale.set(page.depth * (0.94 - index * 0.002), 1, 1)
    dummy.updateMatrix()
    mesh.setMatrixAt(PAGE_EDGE_LAYERS + index, dummy.matrix)
    const color = baseColor.clone().lerp(warmColor, 0.25 + t * 0.32)
    mesh.setColorAt(index, color)
    mesh.setColorAt(PAGE_EDGE_LAYERS + index, color)
  }
  mesh.instanceMatrix.setUsage(THREE.StaticDrawUsage)
  mesh.instanceMatrix.needsUpdate = true
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  mesh.userData = { layerCount: PAGE_EDGE_LAYERS, side }
  return finishMesh(mesh, `${side}-page-edge-layers`, options, false)
}

function createPageRuleGeometry(width: number, inverted: boolean) {
  const geometry = new THREE.PlaneGeometry(width * 0.72, 0.014, 12, 1)
  const position = geometry.getAttribute('position')
  for (let index = 0; index < position.count; index += 1) {
    const x = position.getX(index)
    const gutterDistance = x + width / 2
    const crown =
      0.052 * Math.exp(-gutterDistance * 4.4) +
      0.018 * (1 - Math.pow((x * 2) / width, 2)) +
      0.003
    position.setZ(index, crown)
  }
  geometry.rotateX(-Math.PI / 2)
  if (inverted) geometry.scale(1, -1, 1)
  geometry.computeVertexNormals()
  return geometry
}

function createPageStackGeometry(side: PageSide) {
  const page = NOTEBOOK_MODEL_SPEC.page
  const geometry = addSecondaryUv(
    scaleGeometryUvs(
      createRoundedPlateGeometry(
        page.width,
        page.depth,
        page.stackThickness,
        page.planRadius,
        0.012,
      ),
      1.6,
      1.8,
    ),
  )
  geometry.userData = {
    ...geometry.userData,
    gutterProfile: 'stable-rounded-page-block',
    side,
  }
  return geometry
}

function createPageRules(
  side: PageSide,
  materials: ModelMaterialLibrary,
  usePbr: boolean,
  options: ModelFactoryOptions,
) {
  const inverted = side === 'left'
  const geometry = createPageRuleGeometry(NOTEBOOK_MODEL_SPEC.page.width, inverted)
  const mesh = new THREE.InstancedMesh(
    geometry,
    materialFor(usePbr, materials.pageRule, materials),
    PAGE_RULE_COUNT,
  )
  const dummy = new THREE.Object3D()
  for (let index = 0; index < PAGE_RULE_COUNT; index += 1) {
    dummy.position.set(0, 0, -1.04 + index * 0.31)
    dummy.updateMatrix()
    mesh.setMatrixAt(index, dummy.matrix)
  }
  mesh.instanceMatrix.setUsage(THREE.StaticDrawUsage)
  mesh.instanceMatrix.needsUpdate = true
  mesh.userData = { lineCount: PAGE_RULE_COUNT, side }
  return finishMesh(mesh, `${side}-page-rules`, options, false)
}

function createPageAssembly(
  side: PageSide,
  materials: ModelMaterialLibrary,
  usePbr: boolean,
  options: ModelFactoryOptions,
) {
  const pages = new THREE.Group()
  pages.name = `${side}-pages`
  const page = NOTEBOOK_MODEL_SPEC.page
  const stackGeometry = createPageStackGeometry(side)
  const stack = finishMesh(
    new THREE.Mesh(
      stackGeometry,
      materialFor(usePbr, materials.paperEdge, materials),
    ),
    `${side}-page-stack`,
    options,
  )
  const topGeometry = addSecondaryUv(
    scaleGeometryUvs(
      createCurvedPageGeometry(page.width * 0.97, page.depth * 0.97, 1),
      1.5,
      1.7,
    ),
  )
  if (side === 'left') {
    topGeometry.scale(1, -1, 1)
    topGeometry.computeVertexNormals()
  }
  const topPage = finishMesh(
    new THREE.Mesh(topGeometry, materialFor(usePbr, materials.paper, materials)),
    `${side}-top-page`,
    options,
  )
  const faceOffset = page.stackThickness / 2 + 0.006
  topPage.position.y = side === 'left' ? -faceOffset : faceOffset
  topPage.userData = { crownHeight: 0.073, side }

  const edges = createPageEdgeInstances(side, materials, usePbr, options)
  const rules = createPageRules(side, materials, usePbr, options)
  rules.position.y = side === 'left' ? -faceOffset - 0.002 : faceOffset + 0.002
  pages.add(stack)
  return { edges, pages, rules, topPage }
}

function createSpine(
  materials: ModelMaterialLibrary,
  usePbr: boolean,
  options: ModelFactoryOptions,
) {
  const spine = new THREE.Group()
  spine.name = 'notebook-spine'
  spine.position.set(-1.49, 0.18, 0)
  const shellGeometry = new THREE.CapsuleGeometry(0.13, 3.28, 6, 16)
  shellGeometry.rotateX(Math.PI / 2)
  shellGeometry.scale(0.82, 0.78, 1)
  const grooveGeometries = [-0.066, 0.066].map((x) => {
    const geometry = new THREE.CapsuleGeometry(0.014, 3.22, 3, 8)
    geometry.rotateX(Math.PI / 2)
    geometry.applyMatrix4(
      new THREE.Matrix4().compose(
        new THREE.Vector3(x, 0.075, 0),
        new THREE.Quaternion(),
        new THREE.Vector3(0.8, 0.34, 1),
      ),
    )
    return geometry
  })
  const shell = finishMesh(
    new THREE.Mesh(
      mergeAndDispose([shellGeometry, ...grooveGeometries]),
      materialFor(usePbr, materials.clothDark, materials),
    ),
    'spine-cloth-shell',
    options,
  )
  shell.userData = {
    componentIds: [
      'spine-cloth-shell',
      'spine-pressure-groove-1',
      'spine-pressure-groove-2',
    ],
    pressureGrooves: {
      positionsX: [-0.066, 0.066],
      recessIntent: 0.009,
    },
    profile: 'compressed-convex-d',
  }
  spine.add(shell)
  return spine
}

function createNameplate(
  materials: ModelMaterialLibrary,
  usePbr: boolean,
  options: ModelFactoryOptions,
) {
  const nameplate = new THREE.Group()
  nameplate.name = 'blank-brass-nameplate'
  nameplate.position.set(1.5, 0.086, 0.15)
  const plate = finishMesh(
    new THREE.Mesh(
      createRoundedPlateGeometry(1.24, 0.4, 0.036, 0.07, 0.014),
      materialFor(usePbr, materials.brass, materials),
    ),
    'blank-brass-nameplate-plate',
    options,
  )
  const rivetGeometry = new THREE.SphereGeometry(
    0.064,
    16,
    8,
    0,
    Math.PI * 2,
    0,
    Math.PI / 2,
  )
  const rivets = new THREE.InstancedMesh(
    rivetGeometry,
    materialFor(usePbr, materials.brass, materials),
    2,
  )
  const matrix = new THREE.Matrix4()
  matrix.makeTranslation(-0.49, 0.019, 0)
  rivets.setMatrixAt(0, matrix)
  matrix.makeTranslation(0.49, 0.019, 0)
  rivets.setMatrixAt(1, matrix)
  rivets.instanceMatrix.needsUpdate = true
  rivets.userData = { count: 2, headShape: 'raised-dome' }
  finishMesh(rivets, 'nameplate-rivet-pair', options)
  nameplate.add(plate, rivets)
  return { nameplate, rivets }
}

function createBookmark(
  materials: ModelMaterialLibrary,
  usePbr: boolean,
  options: ModelFactoryOptions,
) {
  const ribbon = new THREE.Group()
  ribbon.name = 'continuous-ribbon-bookmark'
  const geometry = createRibbonGeometry(
    NOTEBOOK_MODEL_SPEC.ribbon.width,
    NOTEBOOK_MODEL_SPEC.ribbon.startZ,
    NOTEBOOK_MODEL_SPEC.ribbon.endZ,
    0.012,
  )
  const position = geometry.getAttribute('position')
  const baseX = new Float32Array(position.count)
  const baseY = new Float32Array(position.count)
  for (let index = 0; index < position.count; index += 1) {
    baseX[index] = position.getX(index)
    baseY[index] = position.getY(index)
  }
  const mesh = finishMesh(
    new THREE.Mesh(geometry, materialFor(usePbr, materials.ribbon, materials)),
    'ribbon-v-tail-mesh',
    options,
  )
  const setOpenProgress = (value: number) => {
    const progress = THREE.MathUtils.clamp(value, 0, 1)
    for (let index = 0; index < position.count; index += 1) {
      const t = THREE.MathUtils.clamp(
        THREE.MathUtils.inverseLerp(
          NOTEBOOK_MODEL_SPEC.ribbon.startZ,
          NOTEBOOK_MODEL_SPEC.ribbon.endZ,
          position.getZ(index),
        ),
        0,
        1,
      )
      const easedLength = t * t * (3 - 2 * t)
      const closedCenterX = THREE.MathUtils.lerp(
        OPEN_RIBBON_X,
        CLOSED_RIBBON_X,
        easedLength,
      )
      const centerX = THREE.MathUtils.lerp(closedCenterX, OPEN_RIBBON_X, progress)
      const foreEdgeT = THREE.MathUtils.smoothstep(
        t,
        RIBBON_FORE_EDGE_START,
        1,
      )
      const closedCenterY = THREE.MathUtils.lerp(0.155, -0.035, foreEdgeT)
      const openCenterY = THREE.MathUtils.lerp(0.392, 0.105, foreEdgeT)
      const centerY = THREE.MathUtils.lerp(closedCenterY, openCenterY, progress)
      position.setX(index, (baseX[index] ?? 0) + centerX)
      position.setY(
        index,
        (baseY[index] ?? 0) +
          centerY +
          Math.sin(t * Math.PI) * 0.008,
      )
    }
    position.needsUpdate = true
    geometry.computeVertexNormals()
    geometry.computeBoundingSphere()
  }
  ribbon.userData = {
    anchor: [
      NOTEBOOK_MODEL_SPEC.ribbon.worldX,
      0.39,
      NOTEBOOK_MODEL_SPEC.ribbon.startZ,
    ],
    closedEmbeddedY: 0.155,
    closedTail: [CLOSED_RIBBON_X, -0.035, NOTEBOOK_MODEL_SPEC.ribbon.endZ],
    openTail: [OPEN_RIBBON_X, 0.105, NOTEBOOK_MODEL_SPEC.ribbon.endZ],
    setOpenProgress,
    vNotchDepth: NOTEBOOK_MODEL_SPEC.ribbon.width * 0.75,
  }
  ribbon.add(mesh)
  setOpenProgress(0)
  return ribbon
}

export function createNotebookModel(
  materials: ModelMaterialLibrary,
  options: ModelFactoryOptions = {},
): THREE.Group {
  const pass = options.pass ?? 'optimization-pass'
  const showStructure = isPassEnabled(pass, 'structural-pass')
  const showForm = isPassEnabled(pass, 'form-refinement')
  const usePbr = isPassEnabled(pass, 'material-pass')
  const root = new THREE.Group()
  root.name = 'notebook-model'
  root.userData = {
    factoryLocalRoot: [0, 0, 0],
    pass,
    wrapperPosition: [...NOTEBOOK_MODEL_SPEC.rootPosition],
  }

  const backCover = createCover(
    'back-cover',
    1,
    NOTEBOOK_MODEL_SPEC.cover.width,
    materials,
    usePbr,
    options,
  )
  const coverPivot = new THREE.Group()
  coverPivot.name = 'front-cover-pivot'
  coverPivot.position.set(...NOTEBOOK_MODEL_SPEC.coverHinge)
  coverPivot.userData = {
    axis: [0, 0, 1],
    closedAngle: 0,
    openAngle: NOTEBOOK_MODEL_SPEC.openAngle,
  }
  const frontCover = createCover(
    'front-cover',
    -1,
    NOTEBOOK_MODEL_SPEC.cover.width - 0.08,
    materials,
    usePbr,
    options,
  )
  frontCover.position.x = 1.5
  coverPivot.add(frontCover)

  const right = createPageAssembly('right', materials, usePbr, options)
  const left = createPageAssembly('left', materials, usePbr, options)
  const rightPages = right.pages
  rightPages.position.set(0.04, CLOSED_RIGHT_PAGE_Y, 0)
  rightPages.userData = {
    closedPosition: [0.04, CLOSED_RIGHT_PAGE_Y, 0],
    openPosition: [0.04, OPEN_RIGHT_PAGE_Y, 0],
  }
  const leftPages = left.pages
  leftPages.position.set(1.52, CLOSED_LEFT_PAGE_Y, 0)
  leftPages.userData = {
    closedPosition: [1.52, CLOSED_LEFT_PAGE_Y, 0],
    openPosition: [1.52, OPEN_LEFT_PAGE_Y, 0],
  }
  coverPivot.add(leftPages)
  root.add(backCover, rightPages, coverPivot)

  const spine = createSpine(materials, usePbr, options)
  root.add(spine)
  const gutter = new THREE.Group()
  gutter.name = 'center-gutter'
  gutter.position.set(-1.47, 0.205, 0)
  const gutterGeometry = new THREE.PlaneGeometry(0.15, 3.42, 4, 24)
  const gutterPositions = gutterGeometry.getAttribute('position')
  for (let index = 0; index < gutterPositions.count; index += 1) {
    const normalizedX = Math.min(
      1,
      Math.abs(gutterPositions.getX(index)) / 0.075,
    )
    const valley = -0.05 * Math.pow(1 - normalizedX, 1.35)
    gutterPositions.setZ(index, valley)
  }
  gutterGeometry.rotateX(-Math.PI / 2)
  gutterGeometry.computeVertexNormals()
  gutterGeometry.userData = {
    profile: 'soft-v-page-root',
    valleyDepth: 0.05,
    width: 0.15,
  }
  const gutterMesh = finishMesh(
    new THREE.Mesh(
      gutterGeometry,
      materialFor(usePbr, materials.paperEdge, materials),
    ),
    'center-gutter-valley',
    options,
    false,
  )
  gutter.add(gutterMesh)

  const { nameplate, rivets } = createNameplate(materials, usePbr, options)
  const ribbon = createBookmark(materials, usePbr, options)
  if (showStructure) {
    coverPivot.add(nameplate)
    root.add(gutter, ribbon)
  }
  if (showForm) {
    rightPages.add(right.topPage, right.edges, right.rules)
    leftPages.add(left.topPage, left.edges, left.rules)
  }

  const ribbonSocket = new THREE.Group()
  ribbonSocket.name = 'ribbon-spine-socket'
  ribbonSocket.position.set(
    NOTEBOOK_MODEL_SPEC.ribbon.worldX,
    0.39,
    NOTEBOOK_MODEL_SPEC.ribbon.startZ,
  )
  root.add(ribbonSocket)

  const setOpenProgress = (value: number) => {
    const progress = THREE.MathUtils.clamp(value, 0, 1)
    coverPivot.rotation.z = NOTEBOOK_MODEL_SPEC.openAngle * progress
    rightPages.position.y = THREE.MathUtils.lerp(
      CLOSED_RIGHT_PAGE_Y,
      OPEN_RIGHT_PAGE_Y,
      progress,
    )
    leftPages.position.y = THREE.MathUtils.lerp(
      CLOSED_LEFT_PAGE_Y,
      OPEN_LEFT_PAGE_Y,
      progress,
    )
    gutter.position.y = THREE.MathUtils.lerp(0.205, 0.365, progress)
    ;(ribbon.userData.setOpenProgress as (progress: number) => void)(progress)
  }
  root.userData.setOpenProgress = setOpenProgress
  root.userData.openAngle = NOTEBOOK_MODEL_SPEC.openAngle

  const nodes: NotebookModelNodes = {
    backCover,
    coverPivot,
    frontCover,
    gutter,
    leftPageEdges: left.edges,
    leftPageRules: left.rules,
    leftPages,
    leftTopPage: left.topPage,
    nameplate,
    rightPageEdges: right.edges,
    rightPageRules: right.rules,
    rightPages,
    rightTopPage: right.topPage,
    ribbon,
    rivets,
    root,
    spine,
  }
  setSculptRuntime(root, {
    colliders: {
      'notebook-hit-area': {
        center: [0, 0.2, 0],
        id: 'notebook-hit-area',
        size: [3.18, 0.4, 3.82],
        type: 'box',
      },
      'front-cover': {
        center: [0, 0, 0],
        id: 'front-cover',
        size: [3.12, 0.16, 3.76],
        type: 'box',
      },
    },
    destructionGroups: {
      binding: [spine, gutter, ribbon],
      covers: [backCover, frontCover],
      hardware: [nameplate, rivets],
      pages: [rightPages, leftPages],
    },
    nodes,
    sockets: {
      'cover-hinge': coverPivot,
      'page-gutter': gutter,
      'ribbon-anchor': ribbonSocket,
    },
  })
  const metrics = measureModelResources(root)
  root.userData.dispose = () => disposeModelGeometry(root)
  root.userData.resourceBudget = {
    ...MODEL_LIMITS,
    dpr: [1, 1.5],
  }
  root.userData.resourceMetrics = metrics
  root.userData.reviewContract = {
    criticalFeatureThreshold: 0.82,
    overallThreshold: 0.85,
  }
  root.userData.withinResourceBudget =
    metrics.drawCalls <= MODEL_LIMITS.drawCalls &&
    metrics.triangles <= MODEL_LIMITS.triangles &&
    Math.max(metrics.textures, usePbr ? materials.textureCount : 0) <=
      MODEL_LIMITS.textures
  if (!root.userData.withinResourceBudget) {
    disposeModelGeometry(root)
    throw new Error(
      `Notebook model exceeds its fixed budget: ${JSON.stringify(metrics)}`,
    )
  }
  return root
}
