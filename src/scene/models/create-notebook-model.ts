import * as THREE from 'three'
import {
  createChamferedFrameGeometry,
  createContinuousCaseGeometry,
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

export interface NotebookModelNodes extends Record<string, THREE.Object3D> {
  backCover: THREE.Group
  bookJoints: THREE.InstancedMesh
  caseShell: THREE.Mesh
  closedPageEdges: THREE.InstancedMesh
  coverPivot: THREE.Group
  frontCover: THREE.Group
  gutter: THREE.Mesh
  leftPageEdges: THREE.InstancedMesh
  leftPages: THREE.Group
  leftTopPage: THREE.Mesh
  nameplate: THREE.Group
  pagePivot: THREE.Group
  rapidPageFlipPool: THREE.InstancedMesh
  rightPageEdges: THREE.InstancedMesh
  rightPages: THREE.Group
  rightTopPage: THREE.Mesh
  rivets: THREE.InstancedMesh
  root: THREE.Group
  spineCase: THREE.Mesh
  textBlock: THREE.Mesh
}

type PageSide = 'left' | 'right'

const PAGE_EDGE_LAYERS = 12
const OPEN_STACK_THICKNESS = 0.115
const BACK_COVER_Y = NOTEBOOK_MODEL_SPEC.cover.thickness / 2
const TEXT_BLOCK_Y =
  NOTEBOOK_MODEL_SPEC.cover.thickness +
  NOTEBOOK_MODEL_SPEC.page.stackThickness / 2
const BOOK_HEIGHT =
  NOTEBOOK_MODEL_SPEC.cover.thickness * 2 +
  NOTEBOOK_MODEL_SPEC.page.stackThickness
const PAGE_CENTER_X = 0.06
const PAGE_PIVOT_LOCAL_X = NOTEBOOK_MODEL_SPEC.page.width / 2
const OPEN_PAGE_Y = NOTEBOOK_MODEL_SPEC.cover.thickness + OPEN_STACK_THICKNESS / 2
const RAPID_PAGE_POOL_SIZE = 5
const RAPID_PAGE_TURN_COUNT = 9
const RAPID_PAGE_TURN_OVERLAP = 1.22
const COVER_STAGE_END = 0.36
const FLIP_STAGE_END = 0.9
const RAPID_PAGE_Y = BOOK_HEIGHT + 0.018

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

function createCoverDetails(
  id: 'front-cover' | 'back-cover',
  exteriorDirection: -1 | 1,
  materials: ModelMaterialLibrary,
  usePbr: boolean,
  showForm: boolean,
  options: ModelFactoryOptions,
) {
  const cover = new THREE.Group()
  cover.name = id
  cover.userData = {
    profile: 'cloth-wrapped-soft-cover',
    structuralRole: id === 'front-cover' ? 'front-case-board' : 'back-case-board',
    thickness: NOTEBOOK_MODEL_SPEC.cover.thickness,
    width: NOTEBOOK_MODEL_SPEC.cover.width,
  }

  if (showForm && exteriorDirection === 1) {
    const seamGeometry = addSecondaryUv(
      createChamferedFrameGeometry(
        NOTEBOOK_MODEL_SPEC.cover.width - NOTEBOOK_MODEL_SPEC.cover.seamInset * 2,
        NOTEBOOK_MODEL_SPEC.cover.depth - NOTEBOOK_MODEL_SPEC.cover.seamInset * 2,
        NOTEBOOK_MODEL_SPEC.cover.planRadius - NOTEBOOK_MODEL_SPEC.cover.seamInset,
        0.018,
        NOTEBOOK_MODEL_SPEC.cover.thickness / 2 + 0.006,
      ),
    )
    const seam = finishMesh(
      new THREE.Mesh(
        seamGeometry,
        materialFor(usePbr, materials.notebookCoverDark, materials),
      ),
      'front-cover-wrap-seam',
      options,
      false,
    )
    seam.userData = {
      cornerCount: 4,
      cornerStyle: 'symmetric-chamfer',
      fixedCornerVertices: true,
    }
    cover.add(seam)
  }
  return cover
}

function createContinuousCase(
  materials: ModelMaterialLibrary,
  usePbr: boolean,
  options: ModelFactoryOptions,
) {
  const geometry = addSecondaryUv(
    createContinuousCaseGeometry({
      coverDepth: NOTEBOOK_MODEL_SPEC.cover.depth,
      coverPlanRadius: NOTEBOOK_MODEL_SPEC.cover.planRadius,
      coverThickness: NOTEBOOK_MODEL_SPEC.cover.thickness,
      coverWidth: NOTEBOOK_MODEL_SPEC.cover.width,
      innerSpineInset: NOTEBOOK_MODEL_SPEC.spine.innerInset,
      spineWidth: NOTEBOOK_MODEL_SPEC.spine.width,
      totalHeight: BOOK_HEIGHT + NOTEBOOK_MODEL_SPEC.cover.thickness / 2,
    }),
  )
  const positions = geometry.getAttribute('position') as THREE.BufferAttribute
  positions.setUsage(THREE.DynamicDrawUsage)
  const closedPositions = new Float32Array(positions.array)
  const frontVertexIndices = geometry.userData.frontVertexIndices as number[]
  const frontVertexWeights = geometry.userData.frontVertexWeights as number[]
  const shell = finishMesh(
    new THREE.Mesh(
      geometry,
      materialFor(usePbr, materials.notebookCover, materials),
    ),
    'continuous-case-shell',
    options,
  )
  shell.userData = {
    endCaps: 'wrapped-cloth',
    frontVertexCount: frontVertexIndices.length,
    profile: 'single-continuous-rounded-case',
    singleShell: true,
    structuralRole: 'front-cover-spine-back-cover-shell',
  }

  const setFrontTransform = (angle: number, pivotY: number) => {
    const hingeX = NOTEBOOK_MODEL_SPEC.coverHinge[0]
    const hingeY = NOTEBOOK_MODEL_SPEC.coverHinge[1]
    const cosine = Math.cos(angle)
    const sine = Math.sin(angle)
    for (let vertex = 0; vertex < frontVertexIndices.length; vertex += 1) {
      const index = frontVertexIndices[vertex]!
      const weight = frontVertexWeights[vertex]!
      const offset = index * 3
      const baseX = closedPositions[offset]!
      const baseY = closedPositions[offset + 1]!
      const baseZ = closedPositions[offset + 2]!
      const localX = baseX - hingeX
      const localY = baseY - hingeY
      const transformedX = hingeX + cosine * localX - sine * localY
      const transformedY = pivotY + sine * localX + cosine * localY
      positions.setXYZ(
        index,
        THREE.MathUtils.lerp(baseX, transformedX, weight),
        THREE.MathUtils.lerp(baseY, transformedY, weight),
        baseZ,
      )
    }
    positions.needsUpdate = true
    geometry.computeVertexNormals()
    geometry.computeBoundingBox()
    geometry.computeBoundingSphere()
  }
  return { setFrontTransform, shell }
}

function createTextBlock(
  materials: ModelMaterialLibrary,
  usePbr: boolean,
  options: ModelFactoryOptions,
) {
  const textBlock = finishMesh(
    new THREE.Mesh(
      addSecondaryUv(
        scaleGeometryUvs(
          createRoundedPlateGeometry(
            NOTEBOOK_MODEL_SPEC.page.width,
            NOTEBOOK_MODEL_SPEC.page.depth,
            NOTEBOOK_MODEL_SPEC.page.stackThickness,
            NOTEBOOK_MODEL_SPEC.page.planRadius,
            0.012,
          ),
          1.7,
          2.7,
        ),
      ),
      materialFor(usePbr, materials.paperEdge, materials),
    ),
    'closed-text-block',
    options,
  )
  textBlock.position.set(PAGE_CENTER_X, TEXT_BLOCK_Y, 0)
  textBlock.userData = {
    exposedEdges: ['fore-edge', 'head', 'tail'],
    profile: 'rounded-bowed-text-block',
    thickness: NOTEBOOK_MODEL_SPEC.page.stackThickness,
  }
  return textBlock
}

function createPageEdgeInstances(
  id: string,
  side: PageSide | 'closed',
  thickness: number,
  materials: ModelMaterialLibrary,
  usePbr: boolean,
  options: ModelFactoryOptions,
) {
  const edgeCount = side === 'closed' ? PAGE_EDGE_LAYERS * 3 : PAGE_EDGE_LAYERS * 2
  const geometry = addSecondaryUv(new THREE.BoxGeometry(1, 0.0045, 0.014))
  const edges = new THREE.InstancedMesh(
    geometry,
    materialFor(usePbr, materials.paperEdge, materials),
    edgeCount,
  )
  const dummy = new THREE.Object3D()
  const page = NOTEBOOK_MODEL_SPEC.page
  const cool = new THREE.Color('#eadfc7')
  const warm = new THREE.Color('#cbb998')
  for (let index = 0; index < PAGE_EDGE_LAYERS; index += 1) {
    const t = index / (PAGE_EDGE_LAYERS - 1)
    const y = -thickness / 2 + 0.008 + t * (thickness - 0.016)
    const offset = Math.sin((index + 1) * 2.17) * 0.011
    dummy.position.set(page.width / 2 - 0.012, y, offset)
    dummy.rotation.set(0, Math.PI / 2, 0)
    dummy.scale.set(page.depth * (0.965 - index * 0.0015), 1, 1)
    dummy.updateMatrix()
    edges.setMatrixAt(index, dummy.matrix)

    dummy.position.set(offset, y, page.depth / 2 - 0.012)
    dummy.rotation.set(0, 0, 0)
    dummy.scale.set(page.width * (0.965 - index * 0.0015), 1, 1)
    dummy.updateMatrix()
    edges.setMatrixAt(PAGE_EDGE_LAYERS + index, dummy.matrix)

    if (side === 'closed') {
      dummy.position.set(offset, y, -page.depth / 2 + 0.012)
      dummy.updateMatrix()
      edges.setMatrixAt(PAGE_EDGE_LAYERS * 2 + index, dummy.matrix)
    }
    const color = cool.clone().lerp(warm, 0.2 + t * 0.42)
    edges.setColorAt(index, color)
    edges.setColorAt(PAGE_EDGE_LAYERS + index, color)
    if (side === 'closed') edges.setColorAt(PAGE_EDGE_LAYERS * 2 + index, color)
  }
  edges.instanceMatrix.setUsage(THREE.StaticDrawUsage)
  edges.instanceMatrix.needsUpdate = true
  if (edges.instanceColor) edges.instanceColor.needsUpdate = true
  edges.userData = { layerCount: PAGE_EDGE_LAYERS, side }
  return finishMesh(edges, id, options, false)
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
          OPEN_STACK_THICKNESS,
          NOTEBOOK_MODEL_SPEC.page.planRadius,
          0.008,
        ),
      ),
      materialFor(usePbr, materials.paperEdge, materials),
    ),
    `${side}-opening-page-stack`,
    options,
  )
  const topGeometry = addSecondaryUv(
    scaleGeometryUvs(
      createCurvedPageGeometry(
        NOTEBOOK_MODEL_SPEC.page.width * 0.98,
        NOTEBOOK_MODEL_SPEC.page.depth * 0.985,
        side === 'right' ? 1 : -1,
      ),
      1.5,
      2.5,
    ),
  )
  const topPage = finishMesh(
    new THREE.Mesh(topGeometry, materialFor(usePbr, materials.paper, materials)),
    `${side}-top-page`,
    options,
  )
  topPage.position.y = OPEN_STACK_THICKNESS / 2 + 0.008
  topPage.userData = { crownHeight: 0.073, side }
  const edges = createPageEdgeInstances(
    `${side}-page-edge-layers`,
    side,
    OPEN_STACK_THICKNESS,
    materials,
    usePbr,
    options,
  )
  pages.add(slab, topPage, edges)
  return { edges, pages, topPage }
}

function createBookJoints(
  materials: ModelMaterialLibrary,
  usePbr: boolean,
  showStructure: boolean,
  options: ModelFactoryOptions,
) {
  const geometry = new THREE.CapsuleGeometry(
    NOTEBOOK_MODEL_SPEC.joint.width,
    NOTEBOOK_MODEL_SPEC.cover.depth - NOTEBOOK_MODEL_SPEC.joint.inset * 2,
    3,
    8,
  )
  geometry.rotateX(Math.PI / 2)
  const joints = new THREE.InstancedMesh(
    geometry,
    materialFor(usePbr, materials.notebookCoverDark, materials),
    2,
  )
  joints.name = 'book-joints'
  joints.visible = showStructure
  const dummy = new THREE.Object3D()
  for (const [index, x] of [
    -NOTEBOOK_MODEL_SPEC.cover.width / 2 + NOTEBOOK_MODEL_SPEC.spine.shoulderOffset,
    NOTEBOOK_MODEL_SPEC.joint.axisX,
  ].entries()) {
    dummy.position.set(x, BOOK_HEIGHT + 0.005, 0)
    dummy.updateMatrix()
    joints.setMatrixAt(index, dummy.matrix)
  }
  joints.instanceMatrix.needsUpdate = true
  joints.userData = { count: 2, profile: 'recessed-spine-shoulders' }
  return finishMesh(joints, 'book-joints', options, false)
}

function createNameplate(
  materials: ModelMaterialLibrary,
  usePbr: boolean,
  showForm: boolean,
  options: ModelFactoryOptions,
) {
  const hardware = NOTEBOOK_MODEL_SPEC.hardware
  const nameplate = new THREE.Group()
  nameplate.name = 'blank-brass-nameplate'
  nameplate.position.set(...hardware.platePosition)
  const plate = finishMesh(
    new THREE.Mesh(
      createRoundedPlateGeometry(
        hardware.plateWidth,
        hardware.plateDepth,
        hardware.plateThickness,
        hardware.plateRadius,
        0.012,
      ),
      materialFor(usePbr, materials.brass, materials),
    ),
    'blank-brass-nameplate-plate',
    options,
  )
  nameplate.add(plate)

  const rivets = new THREE.InstancedMesh(
    new THREE.SphereGeometry(
      hardware.rivetRadius,
      16,
      8,
      0,
      Math.PI * 2,
      0,
      Math.PI / 2,
    ),
    materialFor(usePbr, materials.brass, materials),
    2,
  )
  const matrix = new THREE.Matrix4()
  matrix.makeTranslation(-hardware.rivetOffsetX, hardware.plateThickness / 2, 0)
  rivets.setMatrixAt(0, matrix)
  matrix.makeTranslation(hardware.rivetOffsetX, hardware.plateThickness / 2, 0)
  rivets.setMatrixAt(1, matrix)
  rivets.instanceMatrix.needsUpdate = true
  rivets.visible = showForm
  rivets.userData = { count: 2, headShape: 'raised-dome' }
  finishMesh(rivets, 'nameplate-rivet-pair', options)
  nameplate.add(rivets)
  return { nameplate, rivets }
}

function createGutter(
  materials: ModelMaterialLibrary,
  usePbr: boolean,
  options: ModelFactoryOptions,
) {
  const geometry = new THREE.PlaneGeometry(0.16, NOTEBOOK_MODEL_SPEC.page.depth * 0.97, 6, 28)
  const positions = geometry.getAttribute('position')
  for (let index = 0; index < positions.count; index += 1) {
    const normalizedX = Math.min(1, Math.abs(positions.getX(index)) / 0.08)
    positions.setZ(index, -0.048 * Math.pow(1 - normalizedX, 1.35))
  }
  geometry.rotateX(-Math.PI / 2)
  geometry.computeVertexNormals()
  geometry.userData = { profile: 'soft-v-page-root', valleyDepth: 0.048 }
  return finishMesh(
    new THREE.Mesh(geometry, materialFor(usePbr, materials.paperEdge, materials)),
    'center-gutter-valley',
    options,
    false,
  )
}

function createRapidPageFlipPool(
  materials: ModelMaterialLibrary,
  usePbr: boolean,
  options: ModelFactoryOptions,
) {
  const geometry = addSecondaryUv(
    createRoundedPlateGeometry(
      NOTEBOOK_MODEL_SPEC.page.width * 0.985,
      NOTEBOOK_MODEL_SPEC.page.depth * 0.985,
      0.008,
      NOTEBOOK_MODEL_SPEC.page.planRadius,
      0.002,
    ),
  )
  geometry.translate(NOTEBOOK_MODEL_SPEC.page.width * 0.4925, 0, 0)
  const pool = new THREE.InstancedMesh(
    geometry,
    materialFor(usePbr, materials.paper, materials),
    RAPID_PAGE_POOL_SIZE,
  )
  pool.name = 'rapid-page-flip-pool'
  pool.visible = false
  const hidden = new THREE.Matrix4().makeScale(0, 0, 0)
  for (let index = 0; index < RAPID_PAGE_POOL_SIZE; index += 1) {
    pool.setMatrixAt(index, hidden)
  }
  pool.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
  pool.instanceMatrix.needsUpdate = true
  pool.userData = { activeCount: 0, poolSize: RAPID_PAGE_POOL_SIZE }
  return finishMesh(pool, 'rapid-page-flip-pool', options)
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
    modelId: 'warm-paper-atelier-notebook-v2',
    pass,
    structure: 'clothbound-rounded-spine-articulated-notebook',
    wrapperPosition: [...NOTEBOOK_MODEL_SPEC.rootPosition],
  }

  const backCover = createCoverDetails(
    'back-cover',
    -1,
    materials,
    usePbr,
    showForm,
    options,
  )
  backCover.position.y = BACK_COVER_Y
  const textBlock = createTextBlock(materials, usePbr, options)
  const closedPageEdges = createPageEdgeInstances(
    'closed-page-edge-layers',
    'closed',
    NOTEBOOK_MODEL_SPEC.page.stackThickness,
    materials,
    usePbr,
    options,
  )
  closedPageEdges.position.set(PAGE_CENTER_X, TEXT_BLOCK_Y, 0)
  closedPageEdges.visible = showForm
  const { setFrontTransform, shell: caseShell } = createContinuousCase(
    materials,
    usePbr,
    options,
  )
  const spineCase = caseShell
  const bookJoints = createBookJoints(materials, usePbr, showStructure, options)

  const coverPivot = new THREE.Group()
  coverPivot.name = 'front-cover-pivot'
  coverPivot.position.set(...NOTEBOOK_MODEL_SPEC.coverHinge)
  coverPivot.userData = { axis: [0, 0, 1], closedAngle: 0, openAngle: NOTEBOOK_MODEL_SPEC.openAngle }
  const frontCover = createCoverDetails(
    'front-cover',
    1,
    materials,
    usePbr,
    showForm,
    options,
  )
  frontCover.position.set(-NOTEBOOK_MODEL_SPEC.coverHinge[0], 0, 0)
  const { nameplate, rivets } = createNameplate(materials, usePbr, showForm, options)
  if (showStructure) frontCover.add(nameplate)
  coverPivot.add(frontCover)

  const pagePivot = new THREE.Group()
  pagePivot.name = 'left-page-pivot'
  pagePivot.position.set(...NOTEBOOK_MODEL_SPEC.pageHinge)
  pagePivot.userData = { axis: [0, 0, 1], closedAngle: 0, openAngle: NOTEBOOK_MODEL_SPEC.openAngle, role: 'bound-page-root' }
  const right = createOpeningLeaf('right', materials, usePbr, options)
  right.pages.position.set(PAGE_CENTER_X, OPEN_PAGE_Y, 0)
  const left = createOpeningLeaf('left', materials, usePbr, options)
  left.pages.position.set(PAGE_PIVOT_LOCAL_X, 0, 0)
  pagePivot.add(left.pages)

  const gutter = createGutter(materials, usePbr, options)
  gutter.position.set(NOTEBOOK_MODEL_SPEC.pageHinge[0], OPEN_PAGE_Y + OPEN_STACK_THICKNESS / 2 + 0.004, 0)
  gutter.visible = false
  const rapidPageFlipPool = createRapidPageFlipPool(materials, usePbr, options)

  root.add(
    backCover,
    textBlock,
    closedPageEdges,
    caseShell,
    bookJoints,
    coverPivot,
    pagePivot,
    right.pages,
    gutter,
    rapidPageFlipPool,
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
    const spreadProgress = animateRapidPages
      ? THREE.MathUtils.smoothstep(progress, FLIP_STAGE_END - 0.035, 1)
      : THREE.MathUtils.smoothstep(progress, 0.62, 1)
    coverPivot.rotation.z = NOTEBOOK_MODEL_SPEC.openAngle * coverProgress
    coverPivot.position.y = THREE.MathUtils.lerp(
      NOTEBOOK_MODEL_SPEC.coverHinge[1],
      NOTEBOOK_MODEL_SPEC.cover.thickness / 2,
      THREE.MathUtils.smoothstep(coverProgress, 0.5, 1),
    )
    setFrontTransform(coverPivot.rotation.z, coverPivot.position.y)
    pagePivot.rotation.z = NOTEBOOK_MODEL_SPEC.openAngle * spreadProgress
    pagePivot.position.set(...NOTEBOOK_MODEL_SPEC.pageHinge)
    right.pages.visible = spreadProgress > 0.015
    left.pages.visible = spreadProgress > 0.015
    gutter.visible = showStructure && spreadProgress > 0.015
    const openScale = THREE.MathUtils.lerp(0.08, 1, spreadProgress)
    right.pages.scale.y = openScale
    left.pages.scale.y = openScale
    const closedScale = Math.max(0.04, 1 - spreadProgress)
    textBlock.scale.y = closedScale
    closedPageEdges.scale.y = closedScale
    textBlock.visible = spreadProgress < 0.985
    closedPageEdges.visible = showForm && spreadProgress < 0.985
    const flipProgress = THREE.MathUtils.clamp(
      THREE.MathUtils.inverseLerp(COVER_STAGE_END, FLIP_STAGE_END, progress),
      0,
      1,
    )
    const showRapidPages = animateRapidPages && progress >= COVER_STAGE_END && progress < FLIP_STAGE_END
    rapidPageFlipPool.visible = showRapidPages
    let activePageCount = 0
    const dummy = new THREE.Object3D()
    for (let index = 0; index < RAPID_PAGE_POOL_SIZE; index += 1) {
      let localProgress = -1
      for (let turn = index; turn < RAPID_PAGE_TURN_COUNT; turn += RAPID_PAGE_POOL_SIZE) {
        const start = turn / RAPID_PAGE_TURN_COUNT
        const end = (turn + RAPID_PAGE_TURN_OVERLAP) / RAPID_PAGE_TURN_COUNT
        if (flipProgress >= start && flipProgress < end) {
          localProgress = THREE.MathUtils.inverseLerp(start, end, flipProgress)
          break
        }
      }
      if (!showRapidPages || localProgress < 0) {
        dummy.scale.set(0, 0, 0)
        dummy.updateMatrix()
        rapidPageFlipPool.setMatrixAt(index, dummy.matrix)
        continue
      }
      activePageCount += 1
      const turnProgress = THREE.MathUtils.smoothstep(localProgress, 0, 1)
      dummy.position.set(
        NOTEBOOK_MODEL_SPEC.pageHinge[0],
        RAPID_PAGE_Y + Math.sin(localProgress * Math.PI) * 0.12,
        (index - 2) * 0.003,
      )
      dummy.rotation.set(0, 0, NOTEBOOK_MODEL_SPEC.openAngle * turnProgress)
      dummy.scale.set(1, 1, 1)
      dummy.updateMatrix()
      rapidPageFlipPool.setMatrixAt(index, dummy.matrix)
    }
    rapidPageFlipPool.instanceMatrix.needsUpdate = true
    rapidPageFlipPool.userData.activeCount = activePageCount
  }
  root.userData.setOpenProgress = setOpenProgress
  root.userData.getOpenProgress = () => Number(root.userData.openProgress ?? 0)
  root.userData.openAngle = NOTEBOOK_MODEL_SPEC.openAngle

  const nodes: NotebookModelNodes = {
    backCover,
    bookJoints,
    caseShell,
    closedPageEdges,
    coverPivot,
    frontCover,
    gutter,
    leftPageEdges: left.edges,
    leftPages: left.pages,
    leftTopPage: left.topPage,
    nameplate,
    pagePivot,
    rapidPageFlipPool,
    rightPageEdges: right.edges,
    rightPages: right.pages,
    rightTopPage: right.topPage,
    rivets,
    root,
    spineCase,
    textBlock,
  }
  setSculptRuntime(root, {
    attachmentBindings: {},
    colliders: {
      'notebook-hit-area': {
        center: [0, BOOK_HEIGHT / 2, 0],
        id: 'notebook-hit-area',
        size: [NOTEBOOK_MODEL_SPEC.cover.width, BOOK_HEIGHT, NOTEBOOK_MODEL_SPEC.cover.depth],
        type: 'box',
      },
      'front-cover': {
        center: [0, 0, 0],
        id: 'front-cover',
        size: [NOTEBOOK_MODEL_SPEC.cover.width, NOTEBOOK_MODEL_SPEC.cover.thickness, NOTEBOOK_MODEL_SPEC.cover.depth],
        type: 'box',
      },
    },
    destructionGroups: {
      binding: [caseShell, bookJoints, gutter],
      covers: [backCover, frontCover],
      hardware: [nameplate, rivets],
      pages: [textBlock, closedPageEdges, right.pages, left.pages],
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
  root.userData.reviewContract = { criticalFeatureThreshold: 0.82, overallThreshold: 0.85 }
  root.userData.withinResourceBudget =
    metrics.drawCalls <= MODEL_LIMITS.drawCalls &&
    metrics.triangles <= MODEL_LIMITS.triangles &&
    Math.max(metrics.textures, usePbr ? materials.textureCount : 0) <= MODEL_LIMITS.textures
  if (!root.userData.withinResourceBudget) {
    disposeModelGeometry(root)
    throw new Error(`Notebook model exceeds its fixed budget: ${JSON.stringify(metrics)}`)
  }
  return root
}
