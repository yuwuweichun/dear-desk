import * as THREE from 'three'

import {
  createRoundedPlateGeometry,
  createRoundedRectCurve,
  scaleGeometryUvs,
} from './geometry'
import type { ModelMaterialLibrary } from './material-library'
import { DESK_MAT_MODEL_SPEC, MODEL_LIMITS } from './model-specs'
import {
  disposeModelGeometry,
  isPassEnabled,
  markMesh,
  measureModelResources,
  setSculptRuntime,
  type ModelBuildPass,
  type ModelFactoryOptions,
} from './model-types'

export interface DeskMatModelNodes
  extends Record<string, THREE.Object3D> {
  binding: THREE.Object3D
  body: THREE.Mesh
  field: THREE.Object3D
  interactionSurface: THREE.Object3D
  root: THREE.Group
  seam: THREE.Object3D
  stitches: THREE.Object3D
}

const createPassPlaceholder = (name: string, requiredPass: ModelBuildPass) => {
  const placeholder = new THREE.Group()
  placeholder.name = name
  placeholder.userData = { enabled: false, requiredPass }
  return placeholder
}

const createBinding = (
  material: THREE.Material,
  options: ModelFactoryOptions,
) => {
  const spec = DESK_MAT_MODEL_SPEC
  const curve = createRoundedRectCurve(
    spec.width - spec.bindingRadius * 2,
    spec.depth - spec.bindingRadius * 2,
    spec.planRadius - spec.bindingRadius,
    spec.thickness / 2 - spec.bindingRadius,
  )
  const geometry = new THREE.TubeGeometry(
    curve,
    192,
    spec.bindingRadius,
    10,
    true,
  )
  geometry.userData = {
    planRadius: spec.planRadius,
    profile: 'rolled-binding',
    radius: spec.bindingRadius,
  }
  const binding = markMesh(
    new THREE.Mesh(geometry, material),
    'desk-mat-binding',
    options,
  )
  binding.userData.interactive = false
  return binding
}

const createField = (
  material: THREE.Material,
  options: ModelFactoryOptions,
) => {
  const spec = DESK_MAT_MODEL_SPEC
  const thickness = 0.016
  const geometry = scaleGeometryUvs(
    createRoundedPlateGeometry(
      spec.width - spec.bindingInset * 2,
      spec.depth - spec.bindingInset * 2,
      thickness,
      spec.planRadius - spec.bindingInset,
      0.003,
    ),
    7.2,
    5.2,
  )
  geometry.userData.profile = 'inset-padded-field'
  const field = markMesh(
    new THREE.Mesh(geometry, material),
    'desk-mat-field',
    options,
  )
  field.position.y = spec.thickness / 2 - thickness / 2
  field.userData.interactive = false
  return field
}

const createSeam = (
  material: THREE.Material,
  options: ModelFactoryOptions,
) => {
  const spec = DESK_MAT_MODEL_SPEC
  const radius = 0.008
  const curve = createRoundedRectCurve(
    spec.width - spec.bindingInset * 2,
    spec.depth - spec.bindingInset * 2,
    spec.planRadius - spec.bindingInset,
    spec.thickness / 2 - radius,
  )
  const geometry = new THREE.TubeGeometry(curve, 160, radius, 6, true)
  geometry.userData = {
    profile: 'inset-recessed-seam',
    radius,
  }
  const seam = markMesh(
    new THREE.Mesh(geometry, material),
    'desk-mat-inner-seam',
    options,
  )
  seam.castShadow = false
  seam.userData.interactive = false
  return seam
}

const createStitches = (
  material: THREE.Material,
  options: ModelFactoryOptions,
) => {
  const spec = DESK_MAT_MODEL_SPEC
  const radius = 0.004
  const geometry = new THREE.CapsuleGeometry(radius, 0.047, 3, 6)
  geometry.userData = {
    dashLength: 0.055,
    distribution: 'constant-arc-length-rounded-rectangle',
  }

  const stitches = new THREE.InstancedMesh(
    geometry,
    material,
    spec.stitchCount,
  )
  markMesh(stitches, 'desk-mat-stitches', options)
  const curve = createRoundedRectCurve(
    spec.width - spec.stitchInset * 2,
    spec.depth - spec.stitchInset * 2,
    spec.planRadius - spec.stitchInset,
    spec.thickness / 2 + 0.001,
  )
  const sourceAxis = new THREE.Vector3(0, 1, 0)
  const point = new THREE.Vector3()
  const tangent = new THREE.Vector3()
  const quaternion = new THREE.Quaternion()
  const matrix = new THREE.Matrix4()
  const scale = new THREE.Vector3(1, 1, 1)

  for (let index = 0; index < spec.stitchCount; index += 1) {
    const offset = (index + 0.5) / spec.stitchCount
    point.copy(curve.getPointAt(offset))
    tangent.copy(curve.getTangentAt(offset)).setY(0).normalize()
    quaternion.setFromUnitVectors(sourceAxis, tangent)
    matrix.compose(point, quaternion, scale)
    stitches.setMatrixAt(index, matrix)
  }

  stitches.instanceMatrix.needsUpdate = true
  stitches.computeBoundingBox()
  stitches.computeBoundingSphere()
  stitches.castShadow = false
  stitches.userData = {
    ...stitches.userData,
    instanceCount: spec.stitchCount,
    interactive: false,
    seed: 'dd-20260810-002',
  }
  return stitches
}

export function createDeskMatModel(
  materials: ModelMaterialLibrary,
  options: ModelFactoryOptions = {},
): THREE.Group {
  const spec = DESK_MAT_MODEL_SPEC
  const pass = options.pass ?? 'optimization-pass'
  const structuralEnabled = isPassEnabled(pass, 'structural-pass')
  const formEnabled = isPassEnabled(pass, 'form-refinement')
  const materialEnabled = isPassEnabled(pass, 'material-pass')
  const surfaceEnabled = isPassEnabled(pass, 'surface-pass')
  const lightingEnabled = isPassEnabled(pass, 'lighting-pass')
  const interactionEnabled = isPassEnabled(pass, 'interaction-pass')
  const optimizationEnabled = isPassEnabled(pass, 'optimization-pass')
  const root = new THREE.Group()
  root.name = 'desk-mat-model'
  root.position.set(...spec.position)
  root.userData.modelId = 'warm-paper-atelier-desk-mat'
  root.userData.pass = pass
  root.userData.passLayers = {
    blockout: true,
    form: formEnabled,
    interaction: interactionEnabled,
    lighting: lightingEnabled,
    material: materialEnabled,
    optimization: optimizationEnabled,
    structural: structuralEnabled,
    surface: surfaceEnabled,
  }

  const bodyThickness = spec.thickness - 0.008
  const bodyGeometry = scaleGeometryUvs(
    createRoundedPlateGeometry(
      spec.width,
      spec.depth,
      bodyThickness,
      spec.planRadius,
      0.012,
    ),
    7.5,
    5.4,
  )
  bodyGeometry.userData.profile = 'large-plan-radius-body'
  const body = markMesh(
    new THREE.Mesh(
      bodyGeometry,
      materialEnabled ? materials.cloth : materials.neutral,
    ),
    'desk-mat-body',
    options,
  )
  body.position.y = -(spec.thickness - bodyThickness) / 2
  body.userData = {
    ...body.userData,
    interactive: false,
    planRadius: spec.planRadius,
  }
  root.add(body)

  let binding: THREE.Object3D = createPassPlaceholder(
    'desk-mat-binding',
    'structural-pass',
  )
  if (structuralEnabled) {
    binding = createBinding(
      materialEnabled ? materials.clothDark : materials.neutral,
      options,
    )
    root.add(binding)
  }

  let field: THREE.Object3D = createPassPlaceholder(
    'desk-mat-field',
    'form-refinement',
  )
  let seam: THREE.Object3D = createPassPlaceholder(
    'desk-mat-inner-seam',
    'form-refinement',
  )
  if (formEnabled) {
    field = createField(
      materialEnabled ? materials.cloth : materials.neutral,
      options,
    )
    seam = createSeam(
      materialEnabled ? materials.clothDark : materials.neutral,
      options,
    )
    root.add(field, seam)
  }

  let stitches: THREE.Object3D = createPassPlaceholder(
    'desk-mat-stitches',
    'structural-pass',
  )
  if (structuralEnabled) {
    stitches = createStitches(materials.stitch, options)
    root.add(stitches)
  }

  const interactionSurface = new THREE.Object3D()
  interactionSurface.name = 'desk-mat-interaction-surface'
  interactionSurface.position.y = spec.topY - spec.position[1]
  interactionSurface.userData = {
    footprint: {
      centerZ: spec.position[2],
      depth: spec.depth,
      planRadius: spec.planRadius,
      width: spec.width,
    },
    interactionSurface: true,
    ownsPointerEvents: false,
    stickerBounds: {
      maxX: 4.05,
      maxZ: 2.72,
      minX: -4.05,
      minZ: -2.72,
    },
    topY: spec.topY,
  }
  root.add(interactionSurface)

  const nodes: DeskMatModelNodes = {
    binding,
    body,
    field,
    interactionSurface,
    root,
    seam,
    stitches,
  }
  setSculptRuntime(root, {
    colliders: {
      interactionSurface: {
        center: [0, spec.topY - spec.position[1], 0],
        id: 'desk-mat-interaction-surface',
        size: [spec.width, 0.02, spec.depth],
        type: 'box',
      },
    },
    destructionGroups: {},
    nodes,
    sockets: { interactionSurface },
  })
  root.userData = {
    ...root.userData,
    buildPass: pass,
    dispose: () => disposeModelGeometry(root),
    ownsMaterials: false,
    pointerEvents: 'external-interaction-surface',
    reviewContract: {
      criticalFeatureThreshold: 0.82,
      overallThreshold: 0.85,
    },
    stitchCount: structuralEnabled ? spec.stitchCount : 0,
  }

  const metrics = measureModelResources(root)
  const measuredTextureCount = materialEnabled ? materials.textureCount : 0
  root.userData.resourceBudget = {
    ...MODEL_LIMITS,
    dpr: [1, 1.5],
  }
  root.userData.resourceMetrics = metrics
  root.userData.withinResourceBudget =
    metrics.drawCalls <= MODEL_LIMITS.drawCalls &&
    metrics.triangles <= MODEL_LIMITS.triangles &&
    Math.max(metrics.textures, measuredTextureCount) <= MODEL_LIMITS.textures

  if (!root.userData.withinResourceBudget) {
    disposeModelGeometry(root)
    throw new Error(
      `Desk mat model exceeds its fixed budget: ${JSON.stringify(metrics)}`,
    )
  }
  return root
}
