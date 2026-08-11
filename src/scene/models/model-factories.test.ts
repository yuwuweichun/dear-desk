import * as THREE from 'three'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { createDeskMatModel } from './create-desk-mat-model'
import { createDeskModel } from './create-desk-model'
import { createNotebookModel } from './create-notebook-model'
import { createRoundedPlateGeometry } from './geometry'
import {
  createModelMaterialLibrary,
  sampleSurfaceChannels,
  type ModelMaterialLibrary,
} from './material-library'
import {
  DESK_MAT_MODEL_SPEC,
  DESK_MODEL_SPEC,
  MODEL_LIMITS,
  NOTEBOOK_MODEL_SPEC,
} from './model-specs'
import {
  getSculptRuntime,
  measureModelResources,
  type SculptRuntime,
} from './model-types'
import type { DeskMatModelNodes } from './create-desk-mat-model'
import type { DeskModelNodes } from './create-desk-model'
import type { NotebookModelNodes } from './create-notebook-model'

const roots: THREE.Group[] = []
const libraries: ModelMaterialLibrary[] = []
const looseGeometries: THREE.BufferGeometry[] = []

const createTestMaterials = () => {
  const materials = createModelMaterialLibrary({
    anisotropy: 1,
    textureSize: 16,
  })
  libraries.push(materials)
  return materials
}

const trackRoot = <T extends THREE.Group>(root: T) => {
  roots.push(root)
  return root
}

const getRuntime = <TNodes extends Record<string, THREE.Object3D>>(
  root: THREE.Group,
) => getSculptRuntime<TNodes>(root) as SculptRuntime<TNodes>

const uniqueGeometries = (root: THREE.Object3D) => {
  const geometries = new Set<THREE.BufferGeometry>()
  root.traverse((object) => {
    if (object instanceof THREE.Mesh) geometries.add(object.geometry)
  })
  return [...geometries]
}

afterEach(() => {
  roots.splice(0).forEach((root) => {
    ;(root.userData.dispose as (() => void) | undefined)?.()
  })
  libraries.splice(0).forEach((library) => library.dispose())
  looseGeometries.splice(0).forEach((geometry) => geometry.dispose())
})

describe('procedural scene model factories', () => {
  it('keeps large plan radii independent from thin panel thickness', () => {
    const geometry = createRoundedPlateGeometry(4, 3, 0.1, 0.6, 0)
    looseGeometries.push(geometry)
    geometry.computeBoundingBox()

    const bounds = geometry.boundingBox
    expect(bounds).not.toBeNull()
    const size = bounds?.getSize(new THREE.Vector3())
    expect(size?.x).toBeCloseTo(4)
    expect(size?.y).toBeCloseTo(0.1)
    expect(size?.z).toBeCloseTo(3)
    expect(geometry.userData.planRadius).toBe(0.6)
    expect(geometry.userData.planRadius).toBeGreaterThan(0.1 / 2)

    const positions = geometry.getAttribute('position')
    let containsHardPlanCorner = false
    for (let index = 0; index < positions.count; index += 1) {
      if (
        Math.abs(positions.getX(index)) > 1.999 &&
        Math.abs(positions.getZ(index)) > 1.499
      ) {
        containsHardPlanCorner = true
        break
      }
    }
    expect(containsHardPlanCorner).toBe(false)

    expect(DESK_MODEL_SPEC.tabletop.radius).toBeGreaterThan(
      DESK_MODEL_SPEC.tabletop.thickness / 2,
    )
    expect(DESK_MAT_MODEL_SPEC.planRadius).toBeGreaterThan(
      DESK_MAT_MODEL_SPEC.thickness / 2,
    )
    expect(NOTEBOOK_MODEL_SPEC.cover.planRadius).toBeGreaterThan(
      NOTEBOOK_MODEL_SPEC.cover.thickness / 2,
    )
    expect(DESK_MODEL_SPEC.drawers[1].width).toBeGreaterThan(
      DESK_MODEL_SPEC.drawers[0].width * 2,
    )
    expect(DESK_MODEL_SPEC.leg.topRadius).toBeGreaterThan(
      DESK_MODEL_SPEC.leg.bottomRadius,
    )
    expect(NOTEBOOK_MODEL_SPEC.page.width).toBeLessThan(
      NOTEBOOK_MODEL_SPEC.cover.width,
    )
    expect(NOTEBOOK_MODEL_SPEC.page.depth).toBeLessThan(
      NOTEBOOK_MODEL_SPEC.cover.depth,
    )
  })

  it('publishes stable desk, mat, and notebook runtime anchors', () => {
    const materials = createTestMaterials()
    const desk = trackRoot(createDeskModel(materials))
    const mat = trackRoot(createDeskMatModel(materials))
    const notebook = trackRoot(createNotebookModel(materials))

    const deskRuntime = getRuntime<DeskModelNodes>(desk)
    expect(deskRuntime.nodes.root).toBe(desk)
    expect(deskRuntime.nodes.tabletop.userData.planRadius).toBe(
      DESK_MODEL_SPEC.tabletop.radius,
    )
    expect(deskRuntime.nodes.tabletop.geometry.getAttribute('uv1')).toBeTruthy()
    expect(deskRuntime.nodes.legLeftFront.userData.taper).toMatchObject({
      bottomRadius: DESK_MODEL_SPEC.leg.bottomRadius,
      direction: 'narrows-downward',
      topRadius: DESK_MODEL_SPEC.leg.topRadius,
    })
    expect(deskRuntime.sockets['socket-apron-front']!.position.toArray()).toEqual(
      [...DESK_MODEL_SPEC.apron.position],
    )
    expect(deskRuntime.sockets['socket-drawer-center-knob']!.parent?.name).toBe(
      'drawer-center',
    )
    expect(deskRuntime.colliders.tabletop).toEqual({
      center: [0, DESK_MODEL_SPEC.tabletop.positionY, 0],
      id: 'tabletop',
      size: [
        DESK_MODEL_SPEC.tabletop.width,
        DESK_MODEL_SPEC.tabletop.thickness,
        DESK_MODEL_SPEC.tabletop.depth,
      ],
      type: 'box',
    })

    const matRuntime = getRuntime<DeskMatModelNodes>(mat)
    expect(matRuntime.nodes.root).toBe(mat)
    expect(matRuntime.nodes.body.userData.planRadius).toBe(
      DESK_MAT_MODEL_SPEC.planRadius,
    )
    expect(matRuntime.nodes.body.geometry.getAttribute('uv1')).toBeTruthy()
    expect(matRuntime.sockets.interactionSurface).toBe(
      matRuntime.nodes.interactionSurface,
    )
    mat.updateMatrixWorld(true)
    expect(
      matRuntime.nodes.interactionSurface.getWorldPosition(new THREE.Vector3()).y,
    ).toBeCloseTo(DESK_MAT_MODEL_SPEC.topY)
    expect(matRuntime.colliders.interactionSurface!.size).toEqual([
      DESK_MAT_MODEL_SPEC.width,
      0.02,
      DESK_MAT_MODEL_SPEC.depth,
    ])
    expect(matRuntime.nodes.interactionSurface.userData.stickerBounds).toEqual({
      maxX: 4.05,
      maxZ: 2.72,
      minX: -4.05,
      minZ: -2.72,
    })

    const notebookRuntime = getRuntime<NotebookModelNodes>(notebook)
    expect(notebookRuntime.nodes.root).toBe(notebook)
    expect(notebook.userData.wrapperPosition).toEqual([
      ...NOTEBOOK_MODEL_SPEC.rootPosition,
    ])
    expect(notebookRuntime.sockets['cover-hinge']).toBe(
      notebookRuntime.nodes.coverPivot,
    )
    expect(notebookRuntime.nodes.coverPivot.position.toArray()).toEqual([
      ...NOTEBOOK_MODEL_SPEC.coverHinge,
    ])
    const frontCoverShell = notebookRuntime.nodes.frontCover.getObjectByName(
      'front-cover-cloth-shell',
    ) as THREE.Mesh
    expect(frontCoverShell.geometry.getAttribute('uv1')).toBeTruthy()
    expect(notebookRuntime.sockets['ribbon-anchor']!.position.toArray()).toEqual([
      NOTEBOOK_MODEL_SPEC.ribbon.worldX,
      0.39,
      NOTEBOOK_MODEL_SPEC.ribbon.startZ,
    ])
    expect(notebookRuntime.colliders['notebook-hit-area']!.size).toEqual([
      3.18,
      0.4,
      NOTEBOOK_MODEL_SPEC.cover.depth,
    ])

    const setOpenProgress = notebook.userData.setOpenProgress as (
      progress: number,
    ) => void
    setOpenProgress(1)
    expect(notebookRuntime.nodes.coverPivot.rotation.z).toBeCloseTo(
      NOTEBOOK_MODEL_SPEC.openAngle,
    )
    expect(notebookRuntime.nodes.rightPages.position.y).toBeCloseTo(0.3)
    expect(notebookRuntime.nodes.leftPages.position.y).toBeCloseTo(-0.005)
    setOpenProgress(-1)
    expect(notebookRuntime.nodes.coverPivot.rotation.z).toBe(0)
  })

  it('shows pass-critical repeated details from the structural pass', () => {
    const materials = createTestMaterials()
    const mat = trackRoot(
      createDeskMatModel(materials, { pass: 'structural-pass' }),
    )
    const notebook = trackRoot(
      createNotebookModel(materials, { pass: 'structural-pass' }),
    )
    const matRuntime = getRuntime<DeskMatModelNodes>(mat)
    const notebookRuntime = getRuntime<NotebookModelNodes>(notebook)

    expect(matRuntime.nodes.stitches).toBeInstanceOf(THREE.InstancedMesh)
    expect((matRuntime.nodes.stitches as THREE.InstancedMesh).count).toBe(
      DESK_MAT_MODEL_SPEC.stitchCount,
    )
    expect(notebookRuntime.nodes.ribbon.parent).toBe(notebook)
    expect(notebookRuntime.nodes.rightTopPage.parent).toBeNull()
  })

  it('keeps both page blocks behind their curved top pages', () => {
    const materials = createTestMaterials()
    const notebook = trackRoot(createNotebookModel(materials))
    const runtime = getRuntime<NotebookModelNodes>(notebook)
    const rightStack = runtime.nodes.rightPages.getObjectByName(
      'right-page-stack',
    ) as THREE.Mesh
    const leftStack = runtime.nodes.leftPages.getObjectByName(
      'left-page-stack',
    ) as THREE.Mesh

    for (const mesh of [
      rightStack,
      leftStack,
      runtime.nodes.rightTopPage,
      runtime.nodes.leftTopPage,
    ]) {
      mesh.geometry.computeBoundingBox()
      expect(mesh.geometry.boundingBox).not.toBeNull()
    }

    const rightStackTop = rightStack.geometry.boundingBox!.max.y
    const rightPageBottom =
      runtime.nodes.rightTopPage.position.y +
      runtime.nodes.rightTopPage.geometry.boundingBox!.min.y
    expect(rightPageBottom - rightStackTop).toBeGreaterThan(0.004)

    const leftStackBottom = leftStack.geometry.boundingBox!.min.y
    const leftPageTop =
      runtime.nodes.leftTopPage.position.y +
      runtime.nodes.leftTopPage.geometry.boundingBox!.max.y
    expect(leftStackBottom - leftPageTop).toBeGreaterThan(0.004)
  })

  it('uses independent deterministic PBR channels for wood, cloth, and paper', () => {
    const materials = createTestMaterials()
    expect(materials.textureCount).toBe(12)
    expect(new Set(materials.textures).size).toBe(materials.textureCount)

    for (const family of ['wood', 'cloth', 'paper'] as const) {
      const textures = materials.textures.filter(
        (texture) => texture.userData.family === family,
      )
      expect(textures).toHaveLength(4)
      expect(textures.map((texture) => texture.userData.channel).sort()).toEqual([
        'albedo',
        'ao',
        'height',
        'roughness',
      ])
      const albedo = textures.find(
        (texture) => texture.userData.channel === 'albedo',
      )
      expect(albedo?.colorSpace).toBe(THREE.SRGBColorSpace)
      for (const texture of textures) {
        if (texture !== albedo) {
          expect(texture.colorSpace).toBe(THREE.NoColorSpace)
        }
      }

      const first = sampleSurfaceChannels(family, 5, 7, 16)
      const second = sampleSurfaceChannels(family, 5, 7, 16)
      expect(second).toEqual(first)
      expect(new Set([first.ao, first.height, first.roughness]).size).toBe(3)
    }

    for (const material of [
      materials.walnut,
      materials.cloth,
      materials.paper,
    ]) {
      expect(material.map).toBeInstanceOf(THREE.Texture)
      expect(material.aoMap).toBeInstanceOf(THREE.Texture)
      expect(material.bumpMap).toBeInstanceOf(THREE.Texture)
      expect(material.roughnessMap).toBeInstanceOf(THREE.Texture)
      expect(
        new Set([
          material.map,
          material.aoMap,
          material.bumpMap,
          material.roughnessMap,
        ]).size,
      ).toBe(4)
    }

    expect(materials.pageRule.side).toBe(THREE.DoubleSide)
    expect(materials.pageRule.depthWrite).toBe(false)
    expect(materials.pageRule.polygonOffset).toBe(true)
    expect(materials.pageRule.polygonOffsetFactor).toBe(-2)
  })

  it('disposes every owned geometry and shared material resource', () => {
    const materials = createTestMaterials()
    const models = [
      trackRoot(createDeskModel(materials)),
      trackRoot(createDeskMatModel(materials)),
      trackRoot(createNotebookModel(materials)),
    ]

    for (const model of models) {
      const geometrySpies = uniqueGeometries(model).map((geometry) =>
        vi.spyOn(geometry, 'dispose'),
      )
      ;(model.userData.dispose as () => void)()
      geometrySpies.forEach((spy) => expect(spy).toHaveBeenCalledTimes(1))
    }

    const materialResources = new Set<THREE.Material>([
      materials.brass,
      materials.brassDark,
      materials.cloth,
      materials.clothDark,
      materials.ground,
      materials.neutral,
      materials.pageRule,
      materials.paper,
      materials.paperEdge,
      materials.ribbon,
      materials.stitch,
      materials.walnut,
      materials.walnutDark,
      materials.walnutPanel,
    ])
    const materialSpies = [...materialResources].map((material) =>
      vi.spyOn(material, 'dispose'),
    )
    const textureSpies = materials.textures.map((texture) =>
      vi.spyOn(texture, 'dispose'),
    )
    materials.dispose()
    materialSpies.forEach((spy) => expect(spy).toHaveBeenCalledTimes(1))
    textureSpies.forEach((spy) => expect(spy).toHaveBeenCalledTimes(1))
  })

  it('keeps the combined fixed scene inside its resource budget', () => {
    const materials = createTestMaterials()
    const scene = new THREE.Group()
    scene.add(
      trackRoot(createDeskModel(materials)),
      trackRoot(createDeskMatModel(materials)),
      trackRoot(createNotebookModel(materials)),
    )

    const metrics = measureModelResources(scene)
    const fixedSceneDrawCalls = metrics.drawCalls + 2
    expect(fixedSceneDrawCalls).toBeLessThanOrEqual(MODEL_LIMITS.drawCalls)
    expect(metrics.triangles).toBeLessThanOrEqual(MODEL_LIMITS.triangles)
    expect(metrics.textures).toBeLessThanOrEqual(MODEL_LIMITS.textures)
  })
})
