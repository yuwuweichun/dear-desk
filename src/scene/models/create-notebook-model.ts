import * as THREE from 'three'

import {
  createCurvedPageGeometry,
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
  backCover: THREE.Mesh
  bookJoints: THREE.InstancedMesh
  coverPivot: THREE.Group
  frontCover: THREE.Mesh
  leftPageEdges: THREE.InstancedMesh
  leftPages: THREE.Group
  leftTopPage: THREE.Mesh
  pagePivot: THREE.Group
  rapidPageFlipPool: THREE.Group
  rightPageEdges: THREE.InstancedMesh
  rightPages: THREE.Group
  rightTopPage: THREE.Mesh
  root: THREE.Group
  spineCase: THREE.Mesh
  textBlock: THREE.Mesh
}

type PageSide = 'left' | 'right'

const PAGE_EDGE_LAYERS = 8
const OPENING_LEAF_THICKNESS = 0.045
const BACK_COVER_Y = NOTEBOOK_MODEL_SPEC.cover.thickness / 2
const TEXT_BLOCK_Y =
  NOTEBOOK_MODEL_SPEC.cover.thickness +
  NOTEBOOK_MODEL_SPEC.page.stackThickness / 2
const FRONT_COVER_Y =
  NOTEBOOK_MODEL_SPEC.cover.thickness * 1.5 +
  NOTEBOOK_MODEL_SPEC.page.stackThickness
const BOOK_HEIGHT =
  NOTEBOOK_MODEL_SPEC.cover.thickness * 2 +
  NOTEBOOK_MODEL_SPEC.page.stackThickness
const PAGE_CENTER_X = 0.06
const LEFT_LEAF_LOCAL_Y = 0
const PAGE_PIVOT_LOCAL_X = NOTEBOOK_MODEL_SPEC.page.width / 2
const COVER_OPEN_Y = NOTEBOOK_MODEL_SPEC.cover.thickness / 2
const RAPID_PAGE_POOL_SIZE = 5
const RAPID_PAGE_TURN_COUNT = 9
const RAPID_PAGE_TURN_OVERLAP = 1.22
const COVER_STAGE_END = 0.36
const FLIP_STAGE_END = 0.92
const RAPID_PAGE_Y =
  NOTEBOOK_MODEL_SPEC.cover.thickness +
  NOTEBOOK_MODEL_SPEC.page.stackThickness +
  0.01

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

function createCover(
  id: 'front-cover' | 'back-cover',
  materials: ModelMaterialLibrary,
  usePbr: boolean,
  options: ModelFactoryOptions,
) {
  const geometry = addSecondaryUv(
    scaleGeometryUvs(
      createRoundedPlateGeometry(
        NOTEBOOK_MODEL_SPEC.cover.width,
        NOTEBOOK_MODEL_SPEC.cover.depth,
        NOTEBOOK_MODEL_SPEC.cover.thickness,
        NOTEBOOK_MODEL_SPEC.cover.planRadius,
        0.012,
      ),
      3.2,
      4.2,
    ),
  )
  const cover = finishMesh(
    new THREE.Mesh(
      geometry,
      materialFor(usePbr, materials.notebookCover, materials),
    ),
    id,
    options,
  )
  cover.userData = {
    profile: 'thin-hard-cover-board',
    structuralRole: id === 'front-cover' ? 'front-case-board' : 'back-case-board',
    thickness: NOTEBOOK_MODEL_SPEC.cover.thickness,
    width: NOTEBOOK_MODEL_SPEC.cover.width,
  }
  return cover
}

function createTextBlock(
  materials: ModelMaterialLibrary,
  usePbr: boolean,
  options: ModelFactoryOptions,
) {
  const geometry = addSecondaryUv(
    scaleGeometryUvs(
      createRoundedPlateGeometry(
        NOTEBOOK_MODEL_SPEC.page.width,
        NOTEBOOK_MODEL_SPEC.page.depth,
        NOTEBOOK_MODEL_SPEC.page.stackThickness,
        NOTEBOOK_MODEL_SPEC.page.planRadius,
        0.008,
      ),
      1.6,
      1.8,
    ),
  )
  const textBlock = finishMesh(
    new THREE.Mesh(
      geometry,
      materialFor(usePbr, materials.paperEdge, materials),
    ),
    'closed-text-block',
    options,
  )
  textBlock.position.set(PAGE_CENTER_X, TEXT_BLOCK_Y, 0)
  textBlock.userData = {
    profile: 'single-bound-text-block',
    exposedEdges: ['fore-edge', 'head', 'tail'],
    thickness: NOTEBOOK_MODEL_SPEC.page.stackThickness,
  }
  return textBlock
}

function createSpineCase(
  materials: ModelMaterialLibrary,
  usePbr: boolean,
  options: ModelFactoryOptions,
) {
  const geometry = addSecondaryUv(
    createRoundedPlateGeometry(
      NOTEBOOK_MODEL_SPEC.spine.width,
      NOTEBOOK_MODEL_SPEC.spine.depth,
      BOOK_HEIGHT,
      0.035,
      0,
    ),
  )
  const spineCase = finishMesh(
    new THREE.Mesh(
      geometry,
      materialFor(usePbr, materials.notebookCover, materials),
    ),
    'flat-spine-case',
    options,
  )
  spineCase.position.set(
    -NOTEBOOK_MODEL_SPEC.cover.width / 2 +
      NOTEBOOK_MODEL_SPEC.spine.width / 2,
    BOOK_HEIGHT / 2,
    0,
  )
  spineCase.userData = {
    endCaps: 'flush-with-covers',
    profile: 'narrow-flat-case',
    structuralRole: 'case-spine',
  }
  return spineCase
}

function createBookJoints(
  materials: ModelMaterialLibrary,
  usePbr: boolean,
  options: ModelFactoryOptions,
) {
  const geometry = addSecondaryUv(
    new THREE.BoxGeometry(
      NOTEBOOK_MODEL_SPEC.joint.width,
      0.012,
      NOTEBOOK_MODEL_SPEC.cover.depth - NOTEBOOK_MODEL_SPEC.joint.inset * 2,
    ),
  )
  const joints = new THREE.InstancedMesh(
    geometry,
    materialFor(usePbr, materials.notebookCoverDark, materials),
    2,
  )
  const matrix = new THREE.Matrix4()
  matrix.makeTranslation(
    NOTEBOOK_MODEL_SPEC.joint.axisX,
    BACK_COVER_Y + 0.026,
    0,
  )
  joints.setMatrixAt(0, matrix)
  matrix.makeTranslation(
    NOTEBOOK_MODEL_SPEC.joint.axisX,
    FRONT_COVER_Y + 0.026,
    0,
  )
  joints.setMatrixAt(1, matrix)
  joints.instanceMatrix.needsUpdate = true
  finishMesh(joints, 'book-joints', options)
  joints.userData = {
    count: 2,
    profile: 'recessed-case-joints',
    sharedAxisX: NOTEBOOK_MODEL_SPEC.joint.axisX,
  }
  return joints
}

function createPageEdgeInstances(
  side: PageSide,
  materials: ModelMaterialLibrary,
  usePbr: boolean,
  options: ModelFactoryOptions,
) {
  const geometry = addSecondaryUv(new THREE.BoxGeometry(1, 0.004, 0.014))
  const edges = new THREE.InstancedMesh(
    geometry,
    materialFor(usePbr, materials.paperEdge, materials),
    PAGE_EDGE_LAYERS * 2,
  )
  const dummy = new THREE.Object3D()
  const page = NOTEBOOK_MODEL_SPEC.page
  for (let index = 0; index < PAGE_EDGE_LAYERS; index += 1) {
    const y = (side === 'left' ? -1 : 1) * index * 0.006
    const inset = Math.sin((index + 1) * 1.9) * 0.008
    dummy.position.set(inset, y, page.depth / 2 - 0.01)
    dummy.scale.set(page.width * 0.96, 1, 1)
    dummy.rotation.set(0, 0, 0)
    dummy.updateMatrix()
    edges.setMatrixAt(index, dummy.matrix)

    dummy.position.set(page.width / 2 - 0.01, y, inset)
    dummy.scale.set(page.depth * 0.96, 1, 1)
    dummy.rotation.set(0, Math.PI / 2, 0)
    dummy.updateMatrix()
    edges.setMatrixAt(PAGE_EDGE_LAYERS + index, dummy.matrix)
  }
  edges.instanceMatrix.setUsage(THREE.StaticDrawUsage)
  edges.instanceMatrix.needsUpdate = true
  edges.userData = { layerCount: PAGE_EDGE_LAYERS, side }
  return finishMesh(edges, `${side}-page-edge-layers`, options, false)
}

function createOpeningLeaf(
  side: PageSide,
  materials: ModelMaterialLibrary,
  usePbr: boolean,
  options: ModelFactoryOptions,
) {
  const pages = new THREE.Group()
  pages.name = `${side}-pages`
  pages.visible = false

  const slab = finishMesh(
    new THREE.Mesh(
      addSecondaryUv(
        createRoundedPlateGeometry(
          NOTEBOOK_MODEL_SPEC.page.width,
          NOTEBOOK_MODEL_SPEC.page.depth,
          OPENING_LEAF_THICKNESS,
          NOTEBOOK_MODEL_SPEC.page.planRadius,
          0.006,
        ),
      ),
      materialFor(usePbr, materials.paperEdge, materials),
    ),
    `${side}-opening-page-slab`,
    options,
  )
  const topGeometry = addSecondaryUv(
    createCurvedPageGeometry(
      NOTEBOOK_MODEL_SPEC.page.width * 0.98,
      NOTEBOOK_MODEL_SPEC.page.depth * 0.98,
      1,
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
  topPage.position.y = side === 'left' ? -0.029 : 0.029
  const edges = createPageEdgeInstances(side, materials, usePbr, options)
  pages.add(slab, topPage, edges)
  return { edges, pages, topPage }
}

function createRapidPageFlipPool(
  materials: ModelMaterialLibrary,
  usePbr: boolean,
  options: ModelFactoryOptions,
) {
  const pool = new THREE.Group()
  pool.name = 'rapid-page-flip-pool'
  pool.visible = false

  for (let index = 0; index < RAPID_PAGE_POOL_SIZE; index += 1) {
    const pivot = new THREE.Group()
    pivot.name = `rapid-page-pivot-${index + 1}`
    pivot.position.set(NOTEBOOK_MODEL_SPEC.pageHinge[0], RAPID_PAGE_Y, 0)
    const sheet = finishMesh(
      new THREE.Mesh(
        addSecondaryUv(
          createRoundedPlateGeometry(
            NOTEBOOK_MODEL_SPEC.page.width * 0.985,
            NOTEBOOK_MODEL_SPEC.page.depth * 0.985,
            0.008,
            NOTEBOOK_MODEL_SPEC.page.planRadius,
            0.002,
          ),
        ),
        materialFor(usePbr, materials.paper, materials),
      ),
      `rapid-page-sheet-${index + 1}`,
      options,
    )
    sheet.position.x = NOTEBOOK_MODEL_SPEC.page.width * 0.4925
    sheet.userData = { poolIndex: index, role: 'rapid-page-flip-sheet' }
    pivot.add(sheet)
    pivot.visible = false
    pool.add(pivot)
  }
  return pool
}

export function createNotebookModel(
  materials: ModelMaterialLibrary,
  options: ModelFactoryOptions = {},
): THREE.Group {
  const pass = options.pass ?? 'optimization-pass'
  const showForm = isPassEnabled(pass, 'form-refinement')
  const usePbr = isPassEnabled(pass, 'material-pass')
  const root = new THREE.Group()
  root.name = 'notebook-model'
  root.userData = {
    factoryLocalRoot: [0, 0, 0],
    pass,
    structure: 'single-text-block-flat-case-notebook',
    wrapperPosition: [...NOTEBOOK_MODEL_SPEC.rootPosition],
  }

  const backCover = createCover('back-cover', materials, usePbr, options)
  backCover.position.y = BACK_COVER_Y
  const textBlock = createTextBlock(materials, usePbr, options)
  const spineCase = createSpineCase(materials, usePbr, options)
  const bookJoints = createBookJoints(materials, usePbr, options)

  const coverPivot = new THREE.Group()
  coverPivot.name = 'front-cover-pivot'
  coverPivot.position.set(...NOTEBOOK_MODEL_SPEC.coverHinge)
  coverPivot.userData = {
    axis: [0, 0, 1],
    closedAngle: 0,
    openAngle: NOTEBOOK_MODEL_SPEC.openAngle,
  }
  const frontCover = createCover('front-cover', materials, usePbr, options)
  frontCover.position.x = -NOTEBOOK_MODEL_SPEC.coverHinge[0]
  coverPivot.add(frontCover)

  const pagePivot = new THREE.Group()
  pagePivot.name = 'left-page-pivot'
  pagePivot.position.set(...NOTEBOOK_MODEL_SPEC.pageHinge)
  pagePivot.userData = {
    axis: [0, 0, 1],
    closedAngle: 0,
    openAngle: NOTEBOOK_MODEL_SPEC.openAngle,
    role: 'bound-page-root',
  }

  const right = createOpeningLeaf('right', materials, usePbr, options)
  right.pages.position.set(PAGE_CENTER_X, TEXT_BLOCK_Y, 0)
  const left = createOpeningLeaf('left', materials, usePbr, options)
  left.pages.position.set(PAGE_PIVOT_LOCAL_X, LEFT_LEAF_LOCAL_Y, 0)
  pagePivot.add(left.pages)
  const rapidPageFlipPool = createRapidPageFlipPool(
    materials,
    usePbr,
    options,
  )

  root.add(
    backCover,
    textBlock,
    spineCase,
    bookJoints,
    coverPivot,
    pagePivot,
    rapidPageFlipPool,
    right.pages,
  )

  if (!showForm) {
    right.pages.remove(right.topPage, right.edges)
    left.pages.remove(left.topPage, left.edges)
  }

  const setOpenProgress = (value: number, animateRapidPages = false) => {
    const progress = THREE.MathUtils.clamp(value, 0, 1)
    root.userData.openProgress = progress
    const coverProgress = animateRapidPages
      ? THREE.MathUtils.smoothstep(progress, 0, COVER_STAGE_END)
      : progress
    coverPivot.rotation.z = NOTEBOOK_MODEL_SPEC.openAngle * coverProgress
    const coverSettleProgress = THREE.MathUtils.smoothstep(
      coverProgress,
      0.52,
      1,
    )
    coverPivot.position.y = THREE.MathUtils.lerp(
      NOTEBOOK_MODEL_SPEC.coverHinge[1],
      COVER_OPEN_Y,
      coverSettleProgress,
    )
    pagePivot.rotation.z = 0
    pagePivot.position.set(...NOTEBOOK_MODEL_SPEC.pageHinge)
    textBlock.scale.set(1, 1, 1)
    textBlock.position.set(PAGE_CENTER_X, TEXT_BLOCK_Y, 0)
    textBlock.visible = true
    spineCase.scale.set(1, 1, 1)
    spineCase.position.y = BOOK_HEIGHT / 2
    spineCase.visible = true
    bookJoints.visible = true
    right.pages.visible = false
    left.pages.visible = false

    const flipProgress = THREE.MathUtils.clamp(
      THREE.MathUtils.inverseLerp(COVER_STAGE_END, FLIP_STAGE_END, progress),
      0,
      1,
    )
    const showRapidPages =
      animateRapidPages &&
      progress >= COVER_STAGE_END &&
      progress < FLIP_STAGE_END
    rapidPageFlipPool.visible = showRapidPages
    for (let index = 0; index < RAPID_PAGE_POOL_SIZE; index += 1) {
      const pivot = rapidPageFlipPool.children[index] as THREE.Group
      let localProgress = -1
      for (
        let turn = index;
        turn < RAPID_PAGE_TURN_COUNT;
        turn += RAPID_PAGE_POOL_SIZE
      ) {
        const start = turn / RAPID_PAGE_TURN_COUNT
        const end = (turn + RAPID_PAGE_TURN_OVERLAP) / RAPID_PAGE_TURN_COUNT
        if (flipProgress >= start && flipProgress < end) {
          localProgress = THREE.MathUtils.inverseLerp(start, end, flipProgress)
          break
        }
      }
      pivot.visible = showRapidPages && localProgress >= 0
      if (localProgress < 0) continue
      const turnProgress = THREE.MathUtils.smoothstep(localProgress, 0, 1)
      pivot.rotation.z = NOTEBOOK_MODEL_SPEC.openAngle * turnProgress
      pivot.position.y =
        RAPID_PAGE_Y + Math.sin(localProgress * Math.PI) * 0.12
      pivot.position.z = (index - 2) * 0.003
    }
  }
  root.userData.setOpenProgress = setOpenProgress
  root.userData.getOpenProgress = () =>
    Number(root.userData.openProgress ?? 0)
  root.userData.openAngle = NOTEBOOK_MODEL_SPEC.openAngle

  const nodes: NotebookModelNodes = {
    backCover,
    bookJoints,
    coverPivot,
    frontCover,
    leftPageEdges: left.edges,
    leftPages: left.pages,
    leftTopPage: left.topPage,
    pagePivot,
    rapidPageFlipPool,
    rightPageEdges: right.edges,
    rightPages: right.pages,
    rightTopPage: right.topPage,
    root,
    spineCase,
    textBlock,
  }
  setSculptRuntime(root, {
    colliders: {
      'notebook-hit-area': {
        center: [0, BOOK_HEIGHT / 2, 0],
        id: 'notebook-hit-area',
        size: [
          NOTEBOOK_MODEL_SPEC.cover.width,
          BOOK_HEIGHT,
          NOTEBOOK_MODEL_SPEC.cover.depth,
        ],
        type: 'box',
      },
      'front-cover': {
        center: [0, 0, 0],
        id: 'front-cover',
        size: [
          NOTEBOOK_MODEL_SPEC.cover.width,
          NOTEBOOK_MODEL_SPEC.cover.thickness,
          NOTEBOOK_MODEL_SPEC.cover.depth,
        ],
        type: 'box',
      },
    },
    destructionGroups: {
      binding: [spineCase, bookJoints],
      covers: [backCover, frontCover],
      pages: [textBlock, right.pages, left.pages],
    },
    nodes,
    sockets: {
      'cover-hinge': coverPivot,
      'page-gutter': pagePivot,
    },
  })

  setOpenProgress(0)
  const metrics = measureModelResources(root)
  root.userData.dispose = () => disposeModelGeometry(root)
  root.userData.resourceBudget = { ...MODEL_LIMITS, dpr: [1, 1.5] }
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
