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
    spec.width - spec.stitch.inset * 2,
    spec.depth - spec.stitch.inset * 2,
    spec.planRadius - spec.stitch.inset,
    spec.topY - spec.position[1] + 0.002,
  )
  const geometry = new THREE.CapsuleGeometry(
    spec.stitch.radius,
    spec.stitch.dashLength,
    3,
    6,
  )
  geometry.userData = {
    dashLength: spec.stitch.dashLength,
    distribution: 'constant-arc-length-inset-perimeter',
  }
  const stitches = new THREE.InstancedMesh(
    geometry,
    material,
    spec.stitch.count,
  )
  finish(stitches, 'desk-mat-stitches', options)
  const source = new THREE.Vector3(0, 1, 0)
  const point = new THREE.Vector3()
  const tangent = new THREE.Vector3()
  const quaternion = new THREE.Quaternion()
  const matrix = new THREE.Matrix4()
  for (let index = 0; index < spec.stitch.count; index += 1) {
    const offset = (index + 0.5) / spec.stitch.count
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
    instanceCount: spec.stitch.count,
    interactive: false,
    seed: 'dd-20260817-002-continuous-pad',
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
    modelId: 'warm-paper-atelier-continuous-desk-mat',
    pass,
    structure: 'continuous-pad-with-attached-binding',
  }

  const surfaceLocalTopY = spec.topY - spec.position[1]
  const bodyCenterY =
    surfaceLocalTopY - spec.surface.bodyTopInset - spec.bodyThickness / 2
  const body = finish(
    new THREE.Mesh(
      scaleGeometryUvs(
        createRoundedPlateGeometry(
          spec.width,
          spec.depth,
          spec.bodyThickness,
          spec.planRadius,
          0.015,
          48,
        ),
        spec.surface.uvScale[0],
        spec.surface.uvScale[1],
      ),
      clothDark,
    ),
    'desk-mat-body',
    options,
  )
  body.position.y = bodyCenterY
  body.userData = {
    ...body.userData,
    attachment: {
      contactType: 'grounded-overlap',
      gapTolerance: 0.004,
      overlap: 0.015,
      parentSocket: 'desktop-contact-plane',
    },
    interactive: false,
    planRadius: spec.planRadius,
    profile: 'continuous-low-profile-pad',
  }
  root.add(body)

  let binding: THREE.Object3D = placeholder('desk-mat-binding', 'structural-pass')
  if (showStructure) {
    const curve = createRoundedRectCurve(
      spec.width - spec.binding.inset * 2,
      spec.depth - spec.binding.inset * 2,
      spec.planRadius - spec.binding.inset,
      surfaceLocalTopY - spec.binding.radius * 0.075,
    )
    const bindingGeometry = new THREE.TubeGeometry(
      curve,
      144,
      spec.binding.radius,
      8,
      true,
    )
    bindingGeometry.scale(1, spec.binding.heightScale, 1)
    bindingGeometry.userData = {
      attachment: 'wrapped-overlap',
      overlap: spec.binding.overlap,
      profile: 'compressed-oval',
    }
    binding = finish(
      new THREE.Mesh(bindingGeometry, clothDark),
      'desk-mat-binding',
      options,
    )
    binding.userData = {
      attachment: {
        contactType: 'wrapped-overlap',
        gapTolerance: 0.004,
        overlap: spec.binding.overlap,
        parentSocket: 'desk-mat-sidewall',
      },
      interactive: false,
      planRadius: spec.planRadius,
      profile: 'compressed-attached-binding',
      radius: spec.binding.radius,
    }
    root.add(binding)
  }

  let field: THREE.Object3D = placeholder('desk-mat-field', 'form-refinement')
  if (showForm) {
    field = finish(
      new THREE.Mesh(
        scaleGeometryUvs(
          createRoundedPlateGeometry(
            spec.width - spec.surface.inset * 2,
            spec.depth - spec.surface.inset * 2,
            spec.surface.thickness,
            spec.planRadius - spec.surface.inset,
            0.006,
            48,
          ),
          spec.surface.uvScale[0],
          spec.surface.uvScale[1],
        ),
        cloth,
      ),
      'desk-mat-continuous-work-surface',
      options,
    )
    field.position.y = surfaceLocalTopY - spec.surface.thickness / 2
    field.userData = {
      interactive: false,
      planRadius: spec.planRadius - spec.surface.inset,
      profile: 'continuous-low-crowned-surface',
      trayGap: false,
    }

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
  root.userData.stitchCount = showStructure ? spec.stitch.count : 0

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
