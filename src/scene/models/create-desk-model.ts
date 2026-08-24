import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'

import {
  createRoundedPanelGeometry,
  createRoundedPlateGeometry,
  scaleGeometryUvs,
} from './geometry'
import type { ModelMaterialLibrary } from './material-library'
import { DESK_MODEL_SPEC, MODEL_LIMITS } from './model-specs'
import {
  isPassEnabled,
  getSculptRuntime,
  markMesh,
  measureModelResources,
  setSculptRuntime,
  type ModelFactoryOptions,
  type SculptCollider,
  type SculptRuntime,
} from './model-types'

export interface DeskModelNodes extends Record<string, THREE.Object3D> {
  apron: THREE.Mesh
  drawerCenter: THREE.Group
  drawerCenterFace: THREE.Mesh
  drawerLeft: THREE.Group
  drawerLeftFace: THREE.Mesh
  drawerRight: THREE.Group
  drawerRightFace: THREE.Mesh
  hardware: THREE.Group
  knobBases: THREE.InstancedMesh
  knobCrowns: THREE.InstancedMesh
  legAssembly: THREE.Group
  legLeftFront: THREE.Mesh
  legLeftRear: THREE.Mesh
  legRightFront: THREE.Mesh
  legRightRear: THREE.Mesh
  rearApron: THREE.Mesh
  root: THREE.Group
  sideApronLeft: THREE.Mesh
  sideApronRight: THREE.Mesh
  tabletop: THREE.Mesh
}

export type DrawerId = (typeof DESK_MODEL_SPEC.drawers)[number]['id']

const DRAWER_NODE_KEYS = {
  'drawer-left': 'drawerLeft',
  'drawer-center': 'drawerCenter',
  'drawer-right': 'drawerRight',
} as const satisfies Record<DrawerId, keyof DeskModelNodes>

export function setDeskDrawerProgress(
  root: THREE.Group,
  drawerId: DrawerId,
  progress: number,
) {
  const runtime = getSculptRuntime<DeskModelNodes>(root) as SculptRuntime<DeskModelNodes>
  const drawer = runtime.nodes[DRAWER_NODE_KEYS[drawerId]]
  const action = drawer.userData.action as {
    axis: [number, number, number]
    limits: [number, number]
    role: 'linear-slide'
  }
  const normalized = THREE.MathUtils.clamp(progress, 0, 1)
  const offset = THREE.MathUtils.lerp(action.limits[0], action.limits[1], normalized)
  drawer.position.set(
    action.axis[0] * offset,
    action.axis[1] * offset,
    action.axis[2] * offset,
  )
  runtime.updateAttachments?.()
  return offset
}

const LEG_BINDINGS = [
  { id: 'left-rear-leg', nodeKey: 'legLeftRear', positionIndex: 0 },
  { id: 'right-rear-leg', nodeKey: 'legRightRear', positionIndex: 1 },
  { id: 'left-front-leg', nodeKey: 'legLeftFront', positionIndex: 2 },
  { id: 'right-front-leg', nodeKey: 'legRightFront', positionIndex: 3 },
] as const

const makeSocket = (
  id: string,
  position: readonly [number, number, number],
  rotation: readonly [number, number, number] = [0, 0, 0],
) => {
  const socket = new THREE.Group()
  socket.name = id
  socket.position.set(...position)
  socket.rotation.set(...rotation)
  socket.userData.socket = true
  return socket
}

const setAttachment = (
  object: THREE.Object3D,
  parentSocket: string,
  localStart: [number, number, number],
  localEnd: [number, number, number],
  overlap: number,
) => {
  object.userData.attachment = {
    contactType: 'embedded furniture joint',
    gapTolerance: 0.005,
    localEnd,
    localStart,
    overlap,
    parentSocket,
  }
}

const createTaperedLegGeometry = () => {
  const { bottomRadius, height, topRadius } = DESK_MODEL_SPEC.leg
  const geometry = createRoundedPanelGeometry(
    topRadius * 2,
    topRadius * 2,
    height,
    topRadius * 0.24,
    0.035,
  )
  geometry.rotateX(-Math.PI / 2)

  const positions = geometry.getAttribute('position')
  for (let index = 0; index < positions.count; index += 1) {
    const y = positions.getY(index)
    const normalizedY = THREE.MathUtils.clamp(y / height + 0.5, 0, 1)
    const easedY = THREE.MathUtils.smoothstep(normalizedY, 0, 1)
    const halfSize = THREE.MathUtils.lerp(bottomRadius, topRadius, easedY)
    const taperScale = halfSize / topRadius
    positions.setXYZ(
      index,
      positions.getX(index) * taperScale,
      y,
      positions.getZ(index) * taperScale,
    )
  }

  positions.needsUpdate = true
  const uvs = geometry.getAttribute('uv')
  for (let index = 0; index < uvs.count; index += 1) {
    const u = uvs.getX(index)
    uvs.setXY(index, uvs.getY(index), u)
  }
  uvs.needsUpdate = true
  geometry.computeVertexNormals()
  geometry.computeBoundingBox()
  geometry.computeBoundingSphere()
  geometry.userData.bottomRadius = bottomRadius
  geometry.userData.profile = 'rounded-square-downward-taper'
  geometry.userData.topRadius = topRadius
  return geometry
}

const ensureBudget = (root: THREE.Group, textureCount: number) => {
  const metrics = measureModelResources(root)
  const withinBudget =
    metrics.drawCalls <= MODEL_LIMITS.drawCalls &&
    metrics.triangles <= MODEL_LIMITS.triangles &&
    Math.max(metrics.textures, textureCount) <= MODEL_LIMITS.textures

  root.userData.resourceBudget = {
    ...MODEL_LIMITS,
    dpr: [1, 1.5],
  }
  root.userData.resourceMetrics = metrics
  root.userData.withinResourceBudget = withinBudget

  if (!withinBudget) {
    throw new Error(
      `Desk model exceeds its fixed budget: ${JSON.stringify(metrics)}`,
    )
  }
}

export function createDeskModel(
  materials: ModelMaterialLibrary,
  options: ModelFactoryOptions = {},
): THREE.Group {
  const selectedPass = options.pass ?? 'optimization-pass'
  const structuralEnabled = isPassEnabled(selectedPass, 'structural-pass')
  const formEnabled = isPassEnabled(selectedPass, 'form-refinement')
  const materialEnabled = isPassEnabled(selectedPass, 'material-pass')
  const interactionEnabled = isPassEnabled(selectedPass, 'interaction-pass')
  const optimizationEnabled = isPassEnabled(selectedPass, 'optimization-pass')
  const ownedGeometries = new Set<THREE.BufferGeometry>()
  const own = <T extends THREE.BufferGeometry>(geometry: T) => {
    ownedGeometries.add(geometry)
    return geometry
  }

  const root = new THREE.Group()
  root.name = 'desk-model'
  root.userData.modelId = 'warm-paper-atelier-desk'
  root.userData.pass = selectedPass
  root.userData.structure = 'three-drawer-tapered-leg-writing-desk'
  root.userData.passLayers = {
    blockout: true,
    form: formEnabled,
    interaction: interactionEnabled,
    material: materialEnabled,
    optimization: optimizationEnabled,
    structural: structuralEnabled,
  }

  const neutral = materials.neutral
  const topMaterial: THREE.Material | THREE.Material[] = materialEnabled
    ? [materials.walnut, materials.walnutDark]
    : neutral
  const frameMaterial = materialEnabled ? materials.walnutDark : neutral
  const legMaterial = materialEnabled ? materials.walnutLegs : neutral
  const drawerMaterial: THREE.Material | THREE.Material[] = materialEnabled
    ? [materials.walnutDrawer, materials.walnutDark]
    : neutral
  const knobBaseMaterial = materialEnabled ? materials.brassDark : neutral
  const knobCrownMaterial = materialEnabled ? materials.brass : neutral

  const tabletopGeometry = own(
    scaleGeometryUvs(
      createRoundedPlateGeometry(
        DESK_MODEL_SPEC.tabletop.width,
        DESK_MODEL_SPEC.tabletop.depth,
        DESK_MODEL_SPEC.tabletop.thickness,
        DESK_MODEL_SPEC.tabletop.radius,
        0.09,
        DESK_MODEL_SPEC.tabletop.curveSegments,
      ),
      1.8,
      0.95,
    ),
  )
  const tabletop = new THREE.Mesh(tabletopGeometry, topMaterial)
  tabletop.position.y = DESK_MODEL_SPEC.tabletop.positionY
  tabletop.userData.planRadius = DESK_MODEL_SPEC.tabletop.radius
  tabletop.userData.profile = 'independent-plan-radius-extrusion'
  markMesh(tabletop, 'tabletop-slab', options)
  root.add(tabletop)

  const apronSocket = makeSocket('socket-apron-front', DESK_MODEL_SPEC.apron.position)
  const apronGeometry = own(
    createRoundedPanelGeometry(
      DESK_MODEL_SPEC.apron.width,
      DESK_MODEL_SPEC.apron.height,
      DESK_MODEL_SPEC.apron.depth,
      DESK_MODEL_SPEC.apron.radius,
      0.045,
    ),
  )
  const apron = new THREE.Mesh(apronGeometry, frameMaterial)
  markMesh(apron, 'front-apron', options)
  setAttachment(apron, apronSocket.name, [0, 0, -0.06], [0, 0, 0.06], 0.04)
  apronSocket.add(apron)
  root.add(apronSocket)

  const rearApronGeometry = own(
    createRoundedPanelGeometry(9.44, 0.46, 0.22, 0.1, 0.035),
  )
  const rearApron = new THREE.Mesh(rearApronGeometry, frameMaterial)
  markMesh(rearApron, 'rear-apron', options)
  const rearApronSocket = makeSocket('socket-apron-rear', [0, -0.54, -3.48])
  setAttachment(rearApron, rearApronSocket.name, [0, 0, -0.05], [0, 0, 0.05], 0.04)
  rearApronSocket.add(rearApron)

  const sideApronGeometry = own(
    createRoundedPanelGeometry(0.22, 0.46, 6.56, 0.09, 0.035),
  )
  const sideApronLeft = new THREE.Mesh(sideApronGeometry, frameMaterial)
  const sideApronRight = new THREE.Mesh(sideApronGeometry, frameMaterial)
  markMesh(sideApronLeft, 'left-side-rail', options)
  markMesh(sideApronRight, 'right-side-rail', options)
  const sideApronLeftSocket = makeSocket('socket-apron-left', [-5.08, -0.54, 0.2])
  const sideApronRightSocket = makeSocket('socket-apron-right', [5.08, -0.54, 0.2])
  setAttachment(sideApronLeft, sideApronLeftSocket.name, [0, 0, -3.28], [0, 0, 3.28], 0.06)
  setAttachment(sideApronRight, sideApronRightSocket.name, [0, 0, -3.28], [0, 0, 3.28], 0.06)
  sideApronLeftSocket.add(sideApronLeft)
  sideApronRightSocket.add(sideApronRight)

  if (structuralEnabled) {
    root.add(rearApronSocket, sideApronLeftSocket, sideApronRightSocket)
  }

  const legAssembly = new THREE.Group()
  legAssembly.name = 'desk-leg-assembly'
  const legGeometry = own(createTaperedLegGeometry())
  const legMeshes = {} as Record<(typeof LEG_BINDINGS)[number]['nodeKey'], THREE.Mesh>
  const sockets: Record<string, THREE.Object3D> = {
    [apronSocket.name]: apronSocket,
    [rearApronSocket.name]: rearApronSocket,
    [sideApronLeftSocket.name]: sideApronLeftSocket,
    [sideApronRightSocket.name]: sideApronRightSocket,
  }

  for (const binding of LEG_BINDINGS) {
    const position = DESK_MODEL_SPEC.legPositions[binding.positionIndex]
    const socketY = position[1] + DESK_MODEL_SPEC.leg.height / 2
    const socket = makeSocket(`socket-${binding.id}`, [position[0], socketY, position[2]])
    const leg = new THREE.Mesh(legGeometry, legMaterial)
    leg.position.y = -DESK_MODEL_SPEC.leg.height / 2
    leg.userData.taper = {
      bottomRadius: DESK_MODEL_SPEC.leg.bottomRadius,
      direction: 'narrows-downward',
      topRadius: DESK_MODEL_SPEC.leg.topRadius,
    }
    markMesh(leg, binding.id, options)
    setAttachment(
      leg,
      socket.name,
      [0, 0, 0],
      [0, -DESK_MODEL_SPEC.leg.height, 0],
      0.04,
    )
    socket.add(leg)
    legAssembly.add(socket)
    legMeshes[binding.nodeKey] = leg
    sockets[socket.name] = socket
  }
  root.add(legAssembly)

  const drawerGroups = {} as Record<DrawerId, THREE.Group>
  const drawerFaces = {} as Record<DrawerId, THREE.Mesh>
  const knobSockets: THREE.Group[] = []
  const sideDrawerFaceGeometry = own(
    createRoundedPanelGeometry(
      DESK_MODEL_SPEC.drawers[0].width,
      DESK_MODEL_SPEC.drawerHeight,
      DESK_MODEL_SPEC.drawerDepth,
      DESK_MODEL_SPEC.drawerRadius,
      0.035,
    ),
  )
  const centerDrawerFaceGeometry = own(
    createRoundedPanelGeometry(
      DESK_MODEL_SPEC.drawers[1].width,
      DESK_MODEL_SPEC.drawerHeight,
      DESK_MODEL_SPEC.drawerDepth,
      DESK_MODEL_SPEC.drawerRadius,
      0.035,
    ),
  )
  const drawerBodyDepth = 1.18
  const drawerBodyHeight = DESK_MODEL_SPEC.drawerHeight - 0.14
  const drawerWallThickness = 0.1
  const drawerBodyGeometries = new Map<number, THREE.BufferGeometry>()

  for (const drawerSpec of DESK_MODEL_SPEC.drawers) {
    const bodyWidth = drawerSpec.width - 0.18
    if (drawerBodyGeometries.has(bodyWidth)) continue

    const bottom = new THREE.BoxGeometry(
      bodyWidth,
      drawerWallThickness,
      drawerBodyDepth,
    )
    bottom.translate(0, -drawerBodyHeight / 2 + drawerWallThickness / 2, 0)
    const leftSide = new THREE.BoxGeometry(
      drawerWallThickness,
      drawerBodyHeight,
      drawerBodyDepth,
    )
    leftSide.translate(-bodyWidth / 2 + drawerWallThickness / 2, 0, 0)
    const rightSide = leftSide.clone()
    rightSide.translate(bodyWidth - drawerWallThickness, 0, 0)
    const back = new THREE.BoxGeometry(
      bodyWidth,
      drawerBodyHeight,
      drawerWallThickness,
    )
    back.translate(0, 0, -drawerBodyDepth / 2 + drawerWallThickness / 2)

    const shellParts = [bottom, leftSide, rightSide, back]
    const bodyGeometry = mergeGeometries(shellParts)
    shellParts.forEach((geometry) => geometry.dispose())
    if (!bodyGeometry) throw new Error(`Could not build ${drawerSpec.id} shell`)
    bodyGeometry.userData.openTop = true
    bodyGeometry.userData.shellParts = ['bottom', 'left-side', 'right-side', 'back']
    drawerBodyGeometries.set(bodyWidth, own(bodyGeometry))
  }

  for (const drawerSpec of DESK_MODEL_SPEC.drawers) {
    const group = new THREE.Group()
    group.name = drawerSpec.id
    group.userData.action = {
      axis: [0, 0, 1],
      limits: [0, 0.86],
      role: 'linear-slide',
    }
    const slideSocket = makeSocket(`socket-${drawerSpec.id}-slide`, [
      drawerSpec.positionX,
      DESK_MODEL_SPEC.drawerPositionY,
      DESK_MODEL_SPEC.drawerPositionZ,
    ])
    setAttachment(group, slideSocket.name, [0, 0, -0.5], [0, 0, 0.09], 0.5)

    const faceGeometry = drawerSpec.id === 'drawer-center'
      ? centerDrawerFaceGeometry
      : sideDrawerFaceGeometry
    const face = new THREE.Mesh(faceGeometry, drawerMaterial)
    face.userData.planRadius = DESK_MODEL_SPEC.drawerRadius
    markMesh(face, `${drawerSpec.id}-face`, options)
    group.add(face)

    const bodyWidth = drawerSpec.width - 0.18
    const body = new THREE.Mesh(drawerBodyGeometries.get(bodyWidth)!, frameMaterial)
    body.position.z = -0.66
    body.userData.openTop = true
    markMesh(body, `${drawerSpec.id}-body`, options)
    body.castShadow = false
    group.add(body)

    const knobSocket = makeSocket(
      `socket-${drawerSpec.id}-knob`,
      [0, 0, DESK_MODEL_SPEC.drawerDepth / 2],
      [Math.PI / 2, 0, 0],
    )
    knobSocket.userData.parentDrawer = drawerSpec.id
    group.add(knobSocket)
    knobSockets.push(knobSocket)
    sockets[knobSocket.name] = knobSocket

    slideSocket.add(group)
    sockets[slideSocket.name] = slideSocket
    drawerGroups[drawerSpec.id] = group
    drawerFaces[drawerSpec.id] = face
    if (structuralEnabled) root.add(slideSocket)
  }

  const hardware = new THREE.Group()
  hardware.name = 'desk-instanced-hardware'
  const knobStemDepth = 0.1
  const knobBaseGeometry = own(
    new THREE.CylinderGeometry(0.062, 0.076, knobStemDepth, 18, 1),
  )
  const knobCrownRadius = 0.115
  const knobCrownDepth = 0.075
  const knobCrownGeometry = own(
    new THREE.SphereGeometry(knobCrownRadius, 20, 12),
  )
  const knobBases = new THREE.InstancedMesh(
    knobBaseGeometry,
    knobBaseMaterial,
    knobSockets.length,
  )
  const knobCrowns = new THREE.InstancedMesh(
    knobCrownGeometry,
    knobCrownMaterial,
    knobSockets.length,
  )
  knobBases.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
  knobCrowns.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
  knobBases.userData.socketIds = knobSockets.map((socket) => socket.name)
  knobCrowns.userData.socketIds = knobSockets.map((socket) => socket.name)
  markMesh(knobBases, 'desk-knob-bases', options)
  markMesh(knobCrowns, 'desk-knob-crowns', options)
  hardware.add(knobBases, knobCrowns)
  if (formEnabled) root.add(hardware)

  const rootInverse = new THREE.Matrix4()
  const socketRelative = new THREE.Matrix4()
  const baseOffset = new THREE.Matrix4().makeTranslation(0, knobStemDepth / 2, 0)
  const crownOffset = new THREE.Matrix4().makeTranslation(
    0,
    knobStemDepth + knobCrownDepth * 0.35,
    0,
  )
  const crownScale = new THREE.Matrix4().makeScale(
    1,
    knobCrownDepth / (knobCrownRadius * 2),
    1,
  )
  const updateHardwareAttachments = () => {
    root.updateMatrixWorld(true)
    rootInverse.copy(root.matrixWorld).invert()
    knobSockets.forEach((socket, index) => {
      socketRelative.multiplyMatrices(rootInverse, socket.matrixWorld)
      knobBases.setMatrixAt(index, socketRelative.clone().multiply(baseOffset))
      knobCrowns.setMatrixAt(
        index,
        socketRelative.clone().multiply(crownOffset).multiply(crownScale),
      )
    })
    knobBases.instanceMatrix.needsUpdate = true
    knobCrowns.instanceMatrix.needsUpdate = true
    knobBases.computeBoundingSphere()
    knobCrowns.computeBoundingSphere()
  }
  updateHardwareAttachments()

  const nodes: DeskModelNodes = {
    apron,
    drawerCenter: drawerGroups['drawer-center'],
    drawerCenterFace: drawerFaces['drawer-center'],
    drawerLeft: drawerGroups['drawer-left'],
    drawerLeftFace: drawerFaces['drawer-left'],
    drawerRight: drawerGroups['drawer-right'],
    drawerRightFace: drawerFaces['drawer-right'],
    hardware,
    knobBases,
    knobCrowns,
    legAssembly,
    legLeftFront: legMeshes.legLeftFront,
    legLeftRear: legMeshes.legLeftRear,
    legRightFront: legMeshes.legRightFront,
    legRightRear: legMeshes.legRightRear,
    rearApron,
    root,
    sideApronLeft,
    sideApronRight,
    tabletop,
  }

  const colliders: Record<string, SculptCollider> = {
    apron: {
      center: [...DESK_MODEL_SPEC.apron.position],
      id: 'apron',
      size: [
        DESK_MODEL_SPEC.apron.width,
        DESK_MODEL_SPEC.apron.height,
        DESK_MODEL_SPEC.apron.depth,
      ],
      type: 'box',
    },
    tabletop: {
      center: [0, DESK_MODEL_SPEC.tabletop.positionY, 0],
      id: 'tabletop',
      size: [
        DESK_MODEL_SPEC.tabletop.width,
        DESK_MODEL_SPEC.tabletop.thickness,
        DESK_MODEL_SPEC.tabletop.depth,
      ],
      type: 'box',
    },
  }
  for (const drawerSpec of DESK_MODEL_SPEC.drawers) {
    colliders[drawerSpec.id] = {
      center: [
        drawerSpec.positionX,
        DESK_MODEL_SPEC.drawerPositionY,
        DESK_MODEL_SPEC.drawerPositionZ - 0.3,
      ],
      id: drawerSpec.id,
      size: [drawerSpec.width, DESK_MODEL_SPEC.drawerHeight, 1.2],
      type: 'box',
    }
  }
  for (const binding of LEG_BINDINGS) {
    const position = DESK_MODEL_SPEC.legPositions[binding.positionIndex]
    colliders[binding.id] = {
      center: [position[0], position[1], position[2]],
      id: binding.id,
      size: [
        DESK_MODEL_SPEC.leg.topRadius * 2,
        DESK_MODEL_SPEC.leg.height,
        DESK_MODEL_SPEC.leg.topRadius * 2,
      ],
      type: 'box',
    }
  }

  setSculptRuntime(root, {
    colliders,
    destructionGroups: {
      carcass: [tabletop, apron, rearApron, sideApronLeft, sideApronRight],
      drawers: Object.values(drawerGroups),
      hardware: [knobBases, knobCrowns],
      legs: Object.values(legMeshes),
    },
    nodes,
    sockets,
  })

  const runtime = root.userData.sculptRuntime as {
    attachmentBindings?: unknown
    updateAttachments?: () => void
  }
  runtime.attachmentBindings = knobSockets.map((socket, instanceId) => ({
    instanceId,
    meshes: [knobBases.name, knobCrowns.name],
    parentDrawer: socket.userData.parentDrawer as string,
    parentSocket: socket.name,
  }))
  runtime.updateAttachments = updateHardwareAttachments

  root.userData.logicalParts = [
    { kind: 'integral', name: 'tabletop-edge-band', objectName: tabletop.name },
    { kind: 'module', name: 'leg-set', objectName: legAssembly.name },
    { kind: 'module', name: 'drawer-bank', objectName: root.name },
    { kind: 'module', name: 'knob-assemblies', objectName: hardware.name },
    { instanceId: 0, kind: 'instance', name: 'knob-left', objectName: knobCrowns.name },
    { instanceId: 2, kind: 'instance', name: 'knob-right', objectName: knobCrowns.name },
  ]

  root.userData.dispose = () => {
    ownedGeometries.forEach((geometry) => geometry.dispose())
  }
  root.userData.reviewContract = {
    criticalFeatureThreshold: 0.82,
    overallThreshold: 0.85,
  }
  root.userData.lightingIntent = isPassEnabled(selectedPass, 'lighting-pass')
    ? {
        key: 'single warm upper-left shadow caster',
        contactShadow: true,
        environment: 'restrained dark-green fill',
      }
    : null

  ensureBudget(root, materialEnabled ? materials.textureCount : 0)
  return root
}
