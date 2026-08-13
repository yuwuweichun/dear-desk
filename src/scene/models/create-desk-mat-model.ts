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

export interface DeskMatModelNodes extends Record<string, THREE.Object3D> {
  binding: THREE.Object3D
  body: THREE.Mesh
  field: THREE.Object3D
  interactionSurface: THREE.Object3D
  root: THREE.Group
  stitches: THREE.Object3D
}

const placeholder = (name: string, requiredPass: ModelBuildPass) => {
  const group = new THREE.Group()
  group.name = name
  group.userData = { enabled: false, requiredPass }
  return group
}

const finish = <T extends THREE.Mesh>(
  mesh: T,
  name: string,
  options: ModelFactoryOptions,
) => markMesh(mesh, name, options)

const makeStitches = (
  material: THREE.Material,
  options: ModelFactoryOptions,
) => {
  const spec = DESK_MAT_MODEL_SPEC
  const curve = createRoundedRectCurve(
    spec.width - 0.62,
    spec.depth - 0.62,
    spec.planRadius - 0.2,
    spec.thickness / 2 + 0.075,
  )
  const geometry = new THREE.CapsuleGeometry(0.006, 0.075, 3, 6)
  geometry.userData = {
    dashLength: 0.087,
    distribution: 'spaced-soft-pad-perimeter',
  }
  const stitches = new THREE.InstancedMesh(
    geometry,
    material,
    spec.stitchCount,
  )
  finish(stitches, 'desk-mat-stitches', options)
  const source = new THREE.Vector3(0, 1, 0)
  const point = new THREE.Vector3()
  const tangent = new THREE.Vector3()
  const quaternion = new THREE.Quaternion()
  const matrix = new THREE.Matrix4()
  for (let index = 0; index < spec.stitchCount; index += 1) {
    const offset = (index + 0.5) / spec.stitchCount
    point.copy(curve.getPointAt(offset))
    tangent.copy(curve.getTangentAt(offset)).setY(0).normalize()
    quaternion.setFromUnitVectors(source, tangent)
    matrix.compose(point, quaternion, new THREE.Vector3(1, 1, 1))
    stitches.setMatrixAt(index, matrix)
  }
  stitches.instanceMatrix.needsUpdate = true
  stitches.castShadow = false
  stitches.userData = {
    ...stitches.userData,
    instanceCount: spec.stitchCount,
    interactive: false,
    seed: 'dd-20260812-001-animal-pad',
  }
  return stitches
}

export function createDeskMatModel(
  materials: ModelMaterialLibrary,
  options: ModelFactoryOptions = {},
): THREE.Group {
  const spec = DESK_MAT_MODEL_SPEC
  const pass = options.pass ?? 'optimization-pass'
  const detailed = isPassEnabled(pass, 'material-pass')
  const showStructure = isPassEnabled(pass, 'structural-pass')
  const showForm = isPassEnabled(pass, 'form-refinement')
  const cloth = detailed ? materials.cloth : materials.neutral
  const clothDark = detailed ? materials.clothDark : materials.neutral
  const root = new THREE.Group()
  root.name = 'desk-mat-model'
  root.position.set(...spec.position)
  root.userData = {
    buildPass: pass,
    modelId: 'animal-island-soft-pad',
    pass,
    structure: 'bumper-well',
  }

  // A thick soft bumper establishes a new silhouette instead of a thin cloth sheet.
  const body = finish(
    new THREE.Mesh(
      scaleGeometryUvs(
        createRoundedPlateGeometry(spec.width, spec.depth, 0.18, 0.82, 0.06),
        4.2,
        3.2,
      ),
      clothDark,
    ),
    'desk-mat-body',
    options,
  )
  body.position.y = -0.035
  body.userData = {
    ...body.userData,
    interactive: false,
    planRadius: spec.planRadius,
    profile: 'thick-soft-bumper',
  }
  root.add(body)

  let binding: THREE.Object3D = placeholder('desk-mat-binding', 'structural-pass')
  if (showStructure) {
    const curve = createRoundedRectCurve(
      spec.width - 0.12,
      spec.depth - 0.12,
      0.72,
      0.065,
    )
    binding = finish(
      new THREE.Mesh(new THREE.TubeGeometry(curve, 144, 0.065, 8, true), clothDark),
      'desk-mat-binding',
      options,
    )
    binding.userData = {
      interactive: false,
      planRadius: spec.planRadius,
      profile: 'pill-bumper-rim',
      radius: 0.065,
    }
    root.add(binding)
  }

  let field: THREE.Object3D = placeholder('desk-mat-field', 'form-refinement')
  if (showForm) {
    field = finish(
      new THREE.Mesh(
        scaleGeometryUvs(
          createRoundedPlateGeometry(spec.width - 0.5, spec.depth - 0.5, 0.055, 0.58, 0.018),
          4,
          3,
        ),
        cloth,
      ),
      'desk-mat-recessed-work-field',
      options,
    )
    field.position.y = 0.075
    field.userData = { interactive: false, profile: 'recessed-work-well' }

    root.add(field)
  }

  let stitches: THREE.Object3D = placeholder('desk-mat-stitches', 'structural-pass')
  if (showStructure) {
    stitches = makeStitches(materials.stitch, options)
    root.add(stitches)
  }

  const interactionSurface = new THREE.Group()
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
    stickerBounds: { maxX: 4.05, maxZ: 2.72, minX: -4.05, minZ: -2.72 },
    topY: spec.topY,
  }
  root.add(interactionSurface)

  const nodes: DeskMatModelNodes = {
    binding,
    body,
    field,
    interactionSurface,
    root,
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
    destructionGroups: {
      bumper: [body, binding],
      surface: [field, stitches],
    },
    nodes,
    sockets: { interactionSurface },
  })
  root.userData.dispose = () => disposeModelGeometry(root)
  root.userData.ownsMaterials = false
  root.userData.pointerEvents = 'external-interaction-surface'
  root.userData.reviewContract = { criticalFeatureThreshold: 0.82, overallThreshold: 0.85 }
  root.userData.stitchCount = showStructure ? spec.stitchCount : 0

  const metrics = measureModelResources(root)
  root.userData.resourceBudget = { ...MODEL_LIMITS, dpr: [1, 1.5] }
  root.userData.resourceMetrics = metrics
  root.userData.withinResourceBudget =
    metrics.drawCalls <= MODEL_LIMITS.drawCalls &&
    metrics.triangles <= MODEL_LIMITS.triangles &&
    Math.max(metrics.textures, detailed ? materials.textureCount : 0) <= MODEL_LIMITS.textures
  if (!root.userData.withinResourceBudget) {
    disposeModelGeometry(root)
    throw new Error(`Desk mat model exceeds its fixed budget: ${JSON.stringify(metrics)}`)
  }
  return root
}
