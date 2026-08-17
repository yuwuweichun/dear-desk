import * as THREE from 'three'
import {
  createChamferedFrameGeometry,
  createContinuousOpenSpreadGeometry,
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
import { getNotebookPresentationState } from '../notebook-transition'

export interface NotebookModelNodes extends Record<string, THREE.Object3D> {
  backCover: THREE.Group
  backCoverBoard: THREE.Mesh
  bookVisual: THREE.Group
  caseShell: THREE.Mesh
  closedPageEdges: THREE.InstancedMesh
  coverPivot: THREE.Group
  frontCover: THREE.Group
  frontCoverBoard: THREE.Mesh
  leftPageEdges: THREE.InstancedMesh
  leftPages: THREE.Group
  leftTopPage: THREE.Mesh
  nameplate: THREE.Group
  openSpread: THREE.Mesh
  pagePivot: THREE.Group
  presentationPivot: THREE.Group
  rightPageEdges: THREE.InstancedMesh
  rightPages: THREE.Group
  rightTopPage: THREE.Mesh
  rivets: THREE.InstancedMesh
  root: THREE.Group
  spineLiftPivot: THREE.Group
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
const OPEN_TOP_PAGE_INSET = -0.01
const OPEN_PAGE_Y = NOTEBOOK_MODEL_SPEC.cover.thickness + OPEN_STACK_THICKNESS / 2
const SPINE_AXIS_X = NOTEBOOK_MODEL_SPEC.pageHinge[0]
const OPEN_COVER_CENTER_OFFSET =
  SPINE_AXIS_X - NOTEBOOK_MODEL_SPEC.coverHinge[0]
const UPRIGHT_ANGLE = Math.PI / 2

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

  const board = finishMesh(
    new THREE.Mesh(
      addSecondaryUv(
        scaleGeometryUvs(
          createRoundedPlateGeometry(
            NOTEBOOK_MODEL_SPEC.cover.width,
            NOTEBOOK_MODEL_SPEC.cover.depth,
            NOTEBOOK_MODEL_SPEC.cover.thickness,
            NOTEBOOK_MODEL_SPEC.cover.planRadius,
            0.012,
          ),
          1.7,
          2.7,
        ),
      ),
      materialFor(usePbr, materials.notebookCover, materials),
    ),
    `${id}-board`,
    options,
  )
  board.position.x = -exteriorDirection * OPEN_COVER_CENTER_OFFSET
  board.visible = false
  board.userData = {
    profile: 'flat-open-cover-board',
    structuralRole: id === 'front-cover' ? 'front-case-board' : 'back-case-board',
  }
  cover.add(board)

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
  return { board, cover }
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
        NOTEBOOK_MODEL_SPEC.page.width * 0.975,
        NOTEBOOK_MODEL_SPEC.page.depth * 0.985,
        1,
      ),
      1.5,
      2.5,
    ),
  )
  if (side === 'left') {
    topGeometry.scale(1, -1, 1)
    topGeometry.computeVertexNormals()
  }
  topGeometry.translate(OPEN_TOP_PAGE_INSET, 0, 0)
  const topPage = finishMesh(
    new THREE.Mesh(topGeometry, materialFor(usePbr, materials.paper, materials)),
    `${side}-top-page`,
    options,
  )
  topPage.position.y =
    (OPEN_STACK_THICKNESS / 2 + 0.008) * (side === 'left' ? -1 : 1)
  topPage.userData = {
    broadCrownHeight: 0.025,
    gutterOpeningInset: OPEN_TOP_PAGE_INSET,
    pageRootLiftHeight: 0.065,
    side,
  }
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

function createOpenSpread(
  materials: ModelMaterialLibrary,
  usePbr: boolean,
  options: ModelFactoryOptions,
) {
  const geometry = addSecondaryUv(
    scaleGeometryUvs(
      createContinuousOpenSpreadGeometry(
        NOTEBOOK_MODEL_SPEC.page.width * 1.95,
        NOTEBOOK_MODEL_SPEC.page.depth,
      ),
      3,
      2.5,
    ),
  )
  const spread = finishMesh(
    new THREE.Mesh(geometry, materialFor(usePbr, materials.paper, materials)),
    'continuous-open-page-spread',
    options,
  )
  spread.visible = false
  return spread
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
  const presentationPivot = new THREE.Group()
  presentationPivot.name = 'centered-opening-presentation'
  presentationPivot.userData = {
    anchor: 'notebook-visual-center',
    sequence: ['rise', 'center-spread', 'settle'],
    uprightAngle: UPRIGHT_ANGLE,
  }
  const spineLiftPivot = new THREE.Group()
  spineLiftPivot.name = 'tabletop-spine-hinge'
  spineLiftPivot.position.x = SPINE_AXIS_X
  spineLiftPivot.userData = {
    axis: [0, 0, 1],
    contact: 'tabletop',
    role: 'upright-book-spine',
  }
  const bookVisual = new THREE.Group()
  bookVisual.name = 'notebook-visual-body'
  bookVisual.position.x = -SPINE_AXIS_X
  spineLiftPivot.add(bookVisual)
  presentationPivot.add(spineLiftPivot)
  root.add(presentationPivot)

  const { board: backCoverBoard, cover: backCover } = createCoverDetails(
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

  const coverPivot = new THREE.Group()
  coverPivot.name = 'front-cover-pivot'
  coverPivot.position.set(...NOTEBOOK_MODEL_SPEC.coverHinge)
  coverPivot.userData = { axis: [0, 0, 1], closedAngle: 0, openAngle: NOTEBOOK_MODEL_SPEC.openAngle }
  const { board: frontCoverBoard, cover: frontCover } = createCoverDetails(
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

  const openSpread = createOpenSpread(materials, usePbr, options)
  openSpread.position.set(
    NOTEBOOK_MODEL_SPEC.pageHinge[0],
    OPEN_PAGE_Y + OPEN_STACK_THICKNESS / 2 + 0.008,
    0,
  )
  bookVisual.add(
    backCover,
    textBlock,
    closedPageEdges,
    caseShell,
    coverPivot,
    pagePivot,
    right.pages,
    openSpread,
  )

  if (!showForm) {
    right.pages.remove(right.topPage, right.edges)
    left.pages.remove(left.topPage, left.edges)
    bookVisual.remove(openSpread)
  }

  const setOpenProgress = (value: number) => {
    const progress = THREE.MathUtils.clamp(value, 0, 1)
    root.userData.openProgress = progress
    const presentation = getNotebookPresentationState(progress)
    const spreadProgress = presentation.spreadProgress
    const uprightAngle = UPRIGHT_ANGLE * presentation.uprightProgress
    presentationPivot.position.x =
      -SPINE_AXIS_X * presentation.spineCenterProgress
    spineLiftPivot.rotation.z = uprightAngle
    presentationPivot.userData.presentationState = { ...presentation }
    coverPivot.rotation.z = NOTEBOOK_MODEL_SPEC.openAngle * spreadProgress
    coverPivot.position.y = THREE.MathUtils.lerp(
      NOTEBOOK_MODEL_SPEC.coverHinge[1],
      NOTEBOOK_MODEL_SPEC.cover.thickness / 2,
      THREE.MathUtils.smoothstep(spreadProgress, 0.5, 1),
    )
    setFrontTransform(coverPivot.rotation.z, coverPivot.position.y)
    pagePivot.rotation.z = NOTEBOOK_MODEL_SPEC.openAngle * spreadProgress
    pagePivot.position.set(
      NOTEBOOK_MODEL_SPEC.pageHinge[0],
      THREE.MathUtils.lerp(
        NOTEBOOK_MODEL_SPEC.pageHinge[1],
        OPEN_PAGE_Y,
        THREE.MathUtils.smoothstep(spreadProgress, 0.5, 1),
      ),
      NOTEBOOK_MODEL_SPEC.pageHinge[2],
    )
    right.pages.visible = spreadProgress > 0.015
    left.pages.visible = spreadProgress > 0.015
    const showSeparateCovers = spreadProgress > 0.001
    caseShell.visible = !showSeparateCovers
    backCoverBoard.visible = showSeparateCovers
    frontCoverBoard.visible = showSeparateCovers
    backCoverBoard.position.x = OPEN_COVER_CENTER_OFFSET * spreadProgress
    frontCoverBoard.position.x = -OPEN_COVER_CENTER_OFFSET * spreadProgress
    const showContinuousOpenSpread = spreadProgress >= 0.985
    openSpread.visible = showForm && showContinuousOpenSpread
    left.topPage.visible = !showContinuousOpenSpread
    right.topPage.visible = !showContinuousOpenSpread
    const openScale = THREE.MathUtils.lerp(0.08, 1, spreadProgress)
    right.pages.scale.y = openScale
    left.pages.scale.y = openScale
    const closedScale = Math.max(0.04, 1 - spreadProgress)
    textBlock.scale.y = closedScale
    closedPageEdges.scale.y = closedScale
    textBlock.visible = spreadProgress < 0.985
    closedPageEdges.visible = showForm && spreadProgress < 0.985
  }
  root.userData.setOpenProgress = setOpenProgress
  root.userData.getOpenProgress = () => Number(root.userData.openProgress ?? 0)
  root.userData.openAngle = NOTEBOOK_MODEL_SPEC.openAngle

  const nodes: NotebookModelNodes = {
    backCover,
    backCoverBoard,
    bookVisual,
    caseShell,
    closedPageEdges,
    coverPivot,
    frontCover,
    frontCoverBoard,
    leftPageEdges: left.edges,
    leftPages: left.pages,
    leftTopPage: left.topPage,
    nameplate,
    openSpread,
    pagePivot,
    presentationPivot,
    rightPageEdges: right.edges,
    rightPages: right.pages,
    rightTopPage: right.topPage,
    rivets,
    root,
    spineLiftPivot,
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
      binding: [caseShell],
      covers: [backCover, frontCover],
      hardware: [nameplate, rivets],
      pages: [textBlock, closedPageEdges, right.pages, left.pages, openSpread],
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
