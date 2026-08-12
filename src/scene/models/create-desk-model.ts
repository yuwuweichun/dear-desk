import * as THREE from 'three'

import {
  createRoundedPanelGeometry,
  createRoundedPlateGeometry,
  scaleGeometryUvs,
} from './geometry'
import type { ModelMaterialLibrary } from './material-library'
import { DESK_MODEL_SPEC, MODEL_LIMITS } from './model-specs'
import {
  disposeModelGeometry,
  isPassEnabled,
  markMesh,
  measureModelResources,
  setSculptRuntime,
  type ModelFactoryOptions,
  type SculptCollider,
} from './model-types'

export interface DeskModelNodes extends Record<string, THREE.Object3D> {
  apron: THREE.Mesh
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

const createMesh = (
  geometry: THREE.BufferGeometry,
  material: THREE.Material | THREE.Material[],
  name: string,
  options: ModelFactoryOptions,
) => markMesh(new THREE.Mesh(geometry, material), name, options)

const createSocket = (name: string, position: readonly [number, number, number]) => {
  const socket = new THREE.Group()
  socket.name = name
  socket.position.set(...position)
  socket.userData.socket = true
  return socket
}

const measureAndGuard = (root: THREE.Group, textureCount: number) => {
  const metrics = measureModelResources(root)
  root.userData.resourceBudget = { ...MODEL_LIMITS, dpr: [1, 1.5] }
  root.userData.resourceMetrics = metrics
  root.userData.withinResourceBudget =
    metrics.drawCalls <= MODEL_LIMITS.drawCalls &&
    metrics.triangles <= MODEL_LIMITS.triangles &&
    Math.max(metrics.textures, textureCount) <= MODEL_LIMITS.textures
  if (!root.userData.withinResourceBudget) {
    disposeModelGeometry(root)
    throw new Error(`Desk model exceeds its fixed budget: ${JSON.stringify(metrics)}`)
  }
}

export function createDeskModel(
  materials: ModelMaterialLibrary,
  options: ModelFactoryOptions = {},
): THREE.Group {
  const pass = options.pass ?? 'optimization-pass'
  const detailed = isPassEnabled(pass, 'material-pass')
  const showStructure = isPassEnabled(pass, 'structural-pass')
  const wood = detailed ? materials.walnut : materials.neutral
  const woodDark = detailed ? materials.walnutDark : materials.neutral
  const panel = detailed ? materials.walnutPanel : materials.neutral

  const root = new THREE.Group()
  root.name = 'desk-model'
  root.userData = {
    modelId: 'animal-island-desk',
    pass,
    structure: 'single-top-panel-support-island',
  }

  // One substantial top replaces the previous stacked top and drawer carcass.
  const tabletop = createMesh(
    scaleGeometryUvs(
      createRoundedPlateGeometry(
        12,
        8,
        DESK_MODEL_SPEC.tabletop.thickness,
        0.72,
        0.1,
      ),
      1.2,
      0.5,
    ),
    wood,
    'desk-tabletop',
    options,
  )
  tabletop.position.y = DESK_MODEL_SPEC.tabletop.positionY
  tabletop.userData = {
    planRadius: 0.72,
    profile: 'single-thick-soft-island-top',
  }
  root.add(tabletop)

  // A recessed capsule rail visually separates the work surface from the base.
  const apronSocket = createSocket('socket-apron-front', DESK_MODEL_SPEC.apron.position)
  const apron = createMesh(
    createRoundedPanelGeometry(9.8, 0.42, 0.34, 0.21, 0.06),
    woodDark,
    'desk-front-apron',
    options,
  )
  apron.position.y = 0.16
  apron.userData.profile = 'recessed-capsule-rail'
  apronSocket.add(apron)
  root.add(apronSocket)

  const rearApronSocket = createSocket('socket-apron-rear', [0, -0.74, -3.2])
  const rearApron = createMesh(
    createRoundedPanelGeometry(8.6, 0.36, 0.28, 0.18, 0.05),
    woodDark,
    'desk-rear-apron',
    options,
  )
  rearApronSocket.add(rearApron)

  // Wide rounded side panels replace four traditional legs.
  const legAssembly = new THREE.Group()
  legAssembly.name = 'desk-panel-support-assembly'
  const supportGeometry = createRoundedPanelGeometry(1.05, 2.9, 5.3, 0.5, 0.1)
  const leftSupport = createMesh(supportGeometry, woodDark, 'desk-left-panel-support', options)
  const rightSupport = createMesh(supportGeometry.clone(), woodDark, 'desk-right-panel-support', options)
  leftSupport.position.set(-4.65, -2.02, 0)
  rightSupport.position.set(4.65, -2.02, 0)
  leftSupport.userData.taper = {
    bottomRadius: DESK_MODEL_SPEC.leg.bottomRadius,
    direction: 'panel-support',
    topRadius: DESK_MODEL_SPEC.leg.topRadius,
  }
  rightSupport.userData.taper = { ...leftSupport.userData.taper }

  const leftInset = createMesh(
    createRoundedPanelGeometry(0.08, 1.84, 3.95, 0.4, 0.018),
    panel,
    'desk-left-support-inset',
    options,
  )
  const rightInset = createMesh(
    leftInset.geometry.clone(),
    panel,
    'desk-right-support-inset',
    options,
  )
  leftInset.position.set(-4.1, -2.05, 0)
  rightInset.position.set(4.1, -2.05, 0)
  legAssembly.add(leftSupport, rightSupport, leftInset, rightInset)

  const sideApronLeft = leftInset
  const sideApronRight = rightInset
  const bridge = createMesh(
    createRoundedPanelGeometry(8.1, 0.58, 0.5, 0.28, 0.08),
    woodDark,
    'desk-lower-bridge',
    options,
  )
  bridge.position.set(0, -2.5, -1.72)
  legAssembly.add(bridge)
  if (showStructure) root.add(rearApronSocket, legAssembly)


  const nodes: DeskModelNodes = {
    apron,
    legAssembly,
    legLeftFront: leftSupport,
    legLeftRear: leftInset,
    legRightFront: rightSupport,
    legRightRear: rightInset,
    rearApron,
    root,
    sideApronLeft,
    sideApronRight,
    tabletop,
  }
  const sockets: Record<string, THREE.Object3D> = {
    [apronSocket.name]: apronSocket,
    [rearApronSocket.name]: rearApronSocket,
  }
  root.traverse((object) => {
    if (object.userData.socket) sockets[object.name] = object
  })
  const colliders: Record<string, SculptCollider> = {
    apron: { center: [...DESK_MODEL_SPEC.apron.position], id: 'apron', size: [9.8, 0.42, 0.34], type: 'box' },
    tabletop: {
      center: [0, DESK_MODEL_SPEC.tabletop.positionY, 0],
      id: 'tabletop',
      size: [12, DESK_MODEL_SPEC.tabletop.thickness, 8],
      type: 'box',
    },
  }
  const supportBindings = [
    ['leg-left-rear', leftInset, [-4.1, -2.05, 0]],
    ['leg-right-rear', rightInset, [4.1, -2.05, 0]],
    ['leg-left-front', leftSupport, [-4.65, -2.02, 0]],
    ['leg-right-front', rightSupport, [4.65, -2.02, 0]],
  ] as const
  for (const [id, , center] of supportBindings) {
    colliders[id] = { center: [...center], id, size: [1.05, 2.9, 5.3], type: 'box' }
  }
  setSculptRuntime(root, {
    colliders,
    destructionGroups: {
      carcass: [tabletop, apron, bridge],
      supports: [leftSupport, rightSupport, leftInset, rightInset],
    },
    nodes,
    sockets,
  })
  root.userData.dispose = () => disposeModelGeometry(root)
  root.userData.reviewContract = { criticalFeatureThreshold: 0.82, overallThreshold: 0.85 }
  root.userData.lightingIntent = {
    contactShadow: true,
    environment: 'bright mint studio fill',
    key: 'soft upper-left island light',
  }
  measureAndGuard(root, detailed ? materials.textureCount : 0)
  return root
}
