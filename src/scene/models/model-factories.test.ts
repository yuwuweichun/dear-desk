import * as THREE from 'three'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { createDeskMatModel } from './create-desk-mat-model'
import { createDeskModel } from './create-desk-model'
import { createNotebookModel } from './create-notebook-model'
import { createRoundedPlateGeometry } from './geometry'
import {
  createModelMaterialLibrary,
  applySceneColors,
  getSceneColorConfig,
  DEFAULT_SCENE_PALETTE_VERSION,
  getScenePalette,
  SCENE_MATERIAL_VERSION,
  SCENE_PALETTE,
  SCENE_PALETTE_PRESETS,
  resolveScenePaletteVersion,
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
  it('keeps ten immutable palette candidates while v2 remains the default', () => {
    expect(Object.keys(SCENE_PALETTE_PRESETS)).toEqual([
      'v1', 'v2', 'v3', 'v4', 'v5', 'v6', 'v7', 'v8', 'v9', 'v10',
    ])
    expect(DEFAULT_SCENE_PALETTE_VERSION).toBe('v2')
    expect(SCENE_PALETTE_PRESETS.v1).toEqual({
      background: '#dce4e0',
      mint: '#78958a',
      mintDark: '#526f65',
      wood: '#ad927c',
      woodDark: '#705e50',
      woodPanel: '#bca28b',
    })
    expect(SCENE_PALETTE_PRESETS.v2).toEqual({
      background: '#d5dad8',
      mint: '#73858a',
      mintDark: '#4c5e63',
      wood: '#927054',
      woodDark: '#5f4939',
      woodPanel: '#aa8768',
    })

    for (const [version, preset] of Object.entries(SCENE_PALETTE_PRESETS)) {
      expect(version).toMatch(/^v(?:[1-9]|10)$/)
      Object.values(preset).forEach((value) => expect(value).toMatch(/^#[0-9a-f]{6}$/))
      expect(getScenePalette(version as keyof typeof SCENE_PALETTE_PRESETS)).toMatchObject({
        ...preset,
        notebookCover: '#173f35',
        notebookCoverDark: '#0e2d27',
        paper: '#fffbe7',
        paperEdge: '#e6dcc4',
      })
    }

    expect(resolveScenePaletteVersion('', true)).toBe('v2')
    expect(resolveScenePaletteVersion('?palette=V10', true)).toBe('v10')
    expect(resolveScenePaletteVersion('?palette=v7', true)).toBe('v7')
    expect(resolveScenePaletteVersion('?palette=v11', true)).toBe('v2')
    expect(resolveScenePaletteVersion('?palette=v9', false)).toBe('v2')
  })

  it('uses the v2 walnut and blue-gray surface roles while preserving notebook materials', () => {
    const materials = createTestMaterials()

    expect(SCENE_MATERIAL_VERSION).toBe('V2.0')
    expect(SCENE_PALETTE.background).toBe('#d5dad8')
    expect(SCENE_PALETTE.wood).toBe('#927054')
    expect(SCENE_PALETTE.woodDark).toBe('#5f4939')
    expect(SCENE_PALETTE.woodPanel).toBe('#aa8768')
    expect(SCENE_PALETTE.mint).toBe('#73858a')
    expect(SCENE_PALETTE.mintDark).toBe('#4c5e63')
    expect(materials.walnut.color.getHexString()).toBe('927054')
    expect(materials.walnutDark.color.getHexString()).toBe('5f4939')
    expect(materials.walnutLegs.color.getHexString()).toBe('5f4939')
    expect(materials.walnutPanel.color.getHexString()).toBe('aa8768')
    expect(materials.cloth.color.getHexString()).toBe('73858a')
    expect(materials.clothDark.color.getHexString()).toBe('4c5e63')
    expect(materials.notebookCover.color.getHexString()).toBe('173f35')
    expect(materials.notebookCoverDark.color.getHexString()).toBe('0e2d27')
    expect(materials.notebookCover.aoMapIntensity).toBe(0.3)
    expect(materials.notebookCover.bumpScale).toBe(0.0014)
    expect(materials.notebookCover.roughness).toBe(0.96)
    expect(materials.notebookCoverDark.roughness).toBe(0.98)
    expect(materials.notebookCover).not.toBe(materials.cloth)
    expect(materials.paper.color.getHexString()).toBe('fffbe7')
    expect(materials.paper.aoMapIntensity).toBe(0.12)
    expect(materials.paper.bumpScale).toBe(0.0018)
    expect(materials.paper.roughness).toBe(0.98)
    expect(materials.paperEdge.color.getHexString()).toBe('e6dcc4')
    expect(materials.paperEdge.roughness).toBe(0.96)
    expect(materials.brass.color.getHexString()).toBe('ee7771')
    expect(materials.brass.metalness).toBeLessThan(0.1)
    expect(materials.walnut).toMatchObject({
      aoMapIntensity: 0.18,
      bumpScale: 0.0025,
      clearcoat: 0.1,
      clearcoatRoughness: 0.78,
      roughness: 0.76,
    })
    expect(materials.cloth).toMatchObject({
      aoMapIntensity: 0.18,
      bumpScale: 0.0023,
      roughness: 0.94,
      sheen: 0.12,
      sheenRoughness: 0.95,
    })
  })

  it('updates all editable scene surfaces without replacing material objects', () => {
    const materials = createTestMaterials()
    const colors = {
      ...getSceneColorConfig(),
      deskFrame: '#112233',
      deskLegs: '#445566',
      notebookCover: '#778899',
    }
    const deskFrame = materials.walnutDark
    const deskLegs = materials.walnutLegs

    applySceneColors(materials, colors)

    expect(materials.walnutDark).toBe(deskFrame)
    expect(materials.walnutLegs).toBe(deskLegs)
    expect(materials.walnutDark.color.getHexString()).toBe('112233')
    expect(materials.walnutLegs.color.getHexString()).toBe('445566')
    expect(materials.notebookCover.color.getHexString()).toBe('778899')
    expect(materials.paper.color.getHexString()).toBe('fffbe7')
  })

  it('applies each candidate only to scene surfaces', () => {
    for (const version of Object.keys(SCENE_PALETTE_PRESETS) as Array<keyof typeof SCENE_PALETTE_PRESETS>) {
      const materials = createModelMaterialLibrary({
        anisotropy: 1,
        palette: getScenePalette(version),
        textureSize: 4,
      })
      libraries.push(materials)
      const preset = SCENE_PALETTE_PRESETS[version]

      expect(materials.walnut.color.getHexString()).toBe(preset.wood.slice(1))
      expect(materials.walnutDark.color.getHexString()).toBe(preset.woodDark.slice(1))
      expect(materials.walnutPanel.color.getHexString()).toBe(preset.woodPanel.slice(1))
      expect(materials.cloth.color.getHexString()).toBe(preset.mint.slice(1))
      expect(materials.clothDark.color.getHexString()).toBe(preset.mintDark.slice(1))
      expect(materials.notebookCover.color.getHexString()).toBe('173f35')
      expect(materials.notebookCoverDark.color.getHexString()).toBe('0e2d27')
      expect(materials.paper.color.getHexString()).toBe('fffbe7')
      expect(materials.paperEdge.color.getHexString()).toBe('e6dcc4')
    }
  })

  it('keeps notebook texture samples frozen while wood and cloth stay neutral', () => {
    const coordinates = [
      [0, 0],
      [5, 7],
      [8, 12],
    ] as const
    const kraft = [
      { albedo: [230, 225, 206], ao: 242, height: 124, roughness: 242 },
      { albedo: [232, 226, 207], ao: 243, height: 131, roughness: 242 },
      { albedo: [232, 226, 207], ao: 243, height: 131, roughness: 241 },
    ]
    const paper = [
      { albedo: [255, 251, 231], ao: 246, height: 130, roughness: 237 },
      { albedo: [255, 251, 231], ao: 247, height: 128, roughness: 238 },
      { albedo: [255, 251, 231], ao: 248, height: 129, roughness: 240 },
    ]

    coordinates.forEach(([x, y], index) => {
      expect(sampleSurfaceChannels('kraft', x, y, 16)).toEqual(kraft[index])
      expect(sampleSurfaceChannels('paper', x, y, 16)).toEqual(paper[index])

      for (const family of ['wood', 'cloth'] as const) {
        const { albedo } = sampleSurfaceChannels(family, x, y, 16)
        expect(new Set(albedo).size).toBe(1)
      }
    })
  })

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
    expect(
      NOTEBOOK_MODEL_SPEC.cover.depth / NOTEBOOK_MODEL_SPEC.cover.width,
    ).toBeCloseTo(5 / 3)
    expect(
      NOTEBOOK_MODEL_SPEC.cover.depth - NOTEBOOK_MODEL_SPEC.page.depth,
    ).toBeCloseTo(NOTEBOOK_MODEL_SPEC.page.headTailInset * 2)
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
    expect(desk.userData.structure).toBe('single-top-panel-support-island')
    expect(deskRuntime.nodes.legAssembly.name).toBe(
      'desk-panel-support-assembly',
    )
    expect(deskRuntime.nodes.apron.userData.profile).toBe(
      'recessed-capsule-rail',
    )
    expect(deskRuntime.nodes.legLeftFront.userData.taper).toMatchObject({
      bottomRadius: DESK_MODEL_SPEC.leg.bottomRadius,
      direction: 'panel-support',
      topRadius: DESK_MODEL_SPEC.leg.topRadius,
    })
    expect(deskRuntime.nodes.legLeftFront.material).toBe(materials.walnutLegs)
    expect(deskRuntime.nodes.legRightFront.material).toBe(materials.walnutLegs)
    expect(deskRuntime.nodes.apron.material).toBe(materials.walnutDark)
    expect(deskRuntime.nodes.legLeftFront.material).not.toBe(
      deskRuntime.nodes.apron.material,
    )
    expect(deskRuntime.sockets['socket-apron-front']!.position.toArray()).toEqual(
      [...DESK_MODEL_SPEC.apron.position],
    )
    expect(desk.getObjectByName('desk-floating-underlayer')).toBeUndefined()
    expect(desk.getObjectByName('drawer-center')).toBeUndefined()
    expect(desk.getObjectByName('desk-knob-crowns')).toBeUndefined()
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
    expect(mat.userData.structure).toBe('bumper-well')
    expect(mat.getObjectByName('desk-mat-coral-corner-tabs')).toBeUndefined()
    expect(matRuntime.nodes.body.userData.profile).toBe('thick-soft-bumper')
    expect(matRuntime.nodes.field.name).toBe('desk-mat-recessed-work-field')
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
    expect(NOTEBOOK_MODEL_SPEC.rootPosition[0]).toBe(
      DESK_MAT_MODEL_SPEC.position[0],
    )
    expect(NOTEBOOK_MODEL_SPEC.rootPosition[2]).toBe(
      DESK_MAT_MODEL_SPEC.position[2],
    )
    expect(NOTEBOOK_MODEL_SPEC.deskRotation).toEqual([0, 0, 0])
    expect(NOTEBOOK_MODEL_SPEC.deskRotation[1]).toBe(0)
    expect(NOTEBOOK_MODEL_SPEC.deskRotation[2]).toBe(0)
    expect(notebookRuntime.sockets['cover-hinge']).toBe(
      notebookRuntime.nodes.coverPivot,
    )
    expect(notebookRuntime.sockets['page-gutter']).toBe(
      notebookRuntime.nodes.pagePivot,
    )
    expect(notebookRuntime.nodes.coverPivot.position.toArray()).toEqual([
      ...NOTEBOOK_MODEL_SPEC.coverHinge,
    ])
    expect(notebookRuntime.nodes.pagePivot.position.toArray()).toEqual([
      ...NOTEBOOK_MODEL_SPEC.pageHinge,
    ])
    expect(notebookRuntime.nodes.frontCover.parent).toBe(
      notebookRuntime.nodes.coverPivot,
    )
    expect(notebookRuntime.nodes.leftPages.parent).toBe(
      notebookRuntime.nodes.pagePivot,
    )
    expect(notebookRuntime.nodes.coverPivot.children).not.toContain(
      notebookRuntime.nodes.leftPages,
    )
    expect(notebook.userData.structure).toBe(
      'single-text-block-flat-case-notebook',
    )
    expect(
      notebookRuntime.nodes.frontCover.geometry.getAttribute('uv1'),
    ).toBeTruthy()
    expect(notebookRuntime.nodes.frontCover.userData.profile).toBe(
      'thin-hard-cover-board',
    )
    expect(notebookRuntime.nodes.frontCover.material).toBe(
      materials.notebookCover,
    )
    expect(notebookRuntime.nodes.backCover.material).toBe(
      materials.notebookCover,
    )
    expect(notebookRuntime.nodes.textBlock.name).toBe('closed-text-block')
    expect(notebookRuntime.nodes.textBlock.userData.profile).toBe(
      'single-bound-text-block',
    )
    expect(notebookRuntime.nodes.spineCase.name).toBe('flat-spine-case')
    expect(notebookRuntime.nodes.spineCase.userData).toMatchObject({
      endCaps: 'flush-with-covers',
      profile: 'narrow-flat-case',
    })
    expect(notebookRuntime.nodes.spineCase.material).toBe(
      materials.notebookCover,
    )
    expect(notebookRuntime.nodes.bookJoints.material).toBe(
      materials.notebookCoverDark,
    )
    expect(notebookRuntime.nodes.bookJoints.name).toBe('book-joints')
    expect(notebookRuntime.nodes.bookJoints.count).toBe(2)
    expect(notebookRuntime.nodes.bookJoints.userData.sharedAxisX).toBe(
      NOTEBOOK_MODEL_SPEC.joint.axisX,
    )
    expect(NOTEBOOK_MODEL_SPEC.coverHinge[0]).toBeCloseTo(
      -NOTEBOOK_MODEL_SPEC.cover.width / 2,
    )
    expect(NOTEBOOK_MODEL_SPEC.pageHinge[0]).toBeCloseTo(
      0.06 - NOTEBOOK_MODEL_SPEC.page.width / 2,
    )
    expect(NOTEBOOK_MODEL_SPEC.cover.thickness).toBeLessThan(
      NOTEBOOK_MODEL_SPEC.page.stackThickness / 2,
    )
    expect(notebook.getObjectByName('planner-soft-spine')).toBeUndefined()
    expect(notebook.getObjectByName('planner-spine-capsule')).toBeUndefined()
    expect(notebook.getObjectByName('notebook-binding')).toBeUndefined()
    expect(notebook.getObjectByName('cover-spine-wrap')).toBeUndefined()
    expect(notebook.getObjectByName('page-spine')).toBeUndefined()
    expect(notebook.getObjectByName('right-page-inset-band')).toBeUndefined()
    expect(notebook.getObjectByName('left-page-inset-band')).toBeUndefined()
    expect(notebook.getObjectByName('left-page-rules')).toBeUndefined()
    expect(notebook.getObjectByName('right-page-rules')).toBeUndefined()
    expect(notebook.getObjectByName('continuous-ribbon-bookmark')).toBeUndefined()
    expect(notebook.getObjectByName('ribbon-v-tail-mesh')).toBeUndefined()
    expect(notebookRuntime.sockets['ribbon-anchor']).toBeUndefined()
    expect(notebook.getObjectByName('planner-corner-badge')).toBeUndefined()
    expect(notebook.getObjectByName('nameplate-rivet-pair')).toBeUndefined()
    expect(notebookRuntime.colliders['notebook-hit-area']!.size).toEqual([
      NOTEBOOK_MODEL_SPEC.cover.width,
      NOTEBOOK_MODEL_SPEC.cover.thickness * 2 +
        NOTEBOOK_MODEL_SPEC.page.stackThickness,
      NOTEBOOK_MODEL_SPEC.cover.depth,
    ])

    const setOpenProgress = notebook.userData.setOpenProgress as (
      progress: number,
      animateRapidPages?: boolean,
    ) => void
    const getOpenProgress = notebook.userData.getOpenProgress as () => number
    setOpenProgress(1)
    expect(getOpenProgress()).toBe(1)
    expect(notebookRuntime.nodes.coverPivot.rotation.z).toBeCloseTo(
      NOTEBOOK_MODEL_SPEC.openAngle,
    )
    expect(notebookRuntime.nodes.pagePivot.rotation.z).toBe(0)
    expect(notebookRuntime.nodes.textBlock.visible).toBe(true)
    expect(notebookRuntime.nodes.spineCase.visible).toBe(true)
    expect(notebookRuntime.nodes.leftPages.visible).toBe(false)
    expect(notebookRuntime.nodes.rightPages.visible).toBe(false)
    expect(notebookRuntime.nodes.textBlock.scale.y).toBe(1)
    expect(notebookRuntime.nodes.spineCase.scale.y).toBe(1)
    setOpenProgress(0.5)
    expect(getOpenProgress()).toBe(0.5)
    expect(notebookRuntime.nodes.coverPivot.rotation.z).toBeCloseTo(
      NOTEBOOK_MODEL_SPEC.openAngle / 2,
    )
    expect(notebookRuntime.nodes.pagePivot.rotation.z).toBe(0)
    expect(notebookRuntime.nodes.textBlock.scale.y).toBe(1)
    expect(notebookRuntime.nodes.textBlock.visible).toBe(true)
    for (let step = 1; step <= 20; step += 1) {
      setOpenProgress(step / 20)
      expect(notebookRuntime.nodes.pagePivot.rotation.z).toBe(0)
      expect(notebookRuntime.nodes.leftPages.visible).toBe(false)
      expect(notebookRuntime.nodes.rightPages.visible).toBe(false)
      expect(notebookRuntime.nodes.textBlock.scale.y).toBe(1)
      expect(notebookRuntime.nodes.spineCase.scale.y).toBe(1)
      expect(notebookRuntime.nodes.textBlock.visible).toBe(true)
      expect(notebookRuntime.nodes.spineCase.visible).toBe(true)
    }
    setOpenProgress(0.2, true)
    expect(notebookRuntime.nodes.rapidPageFlipPool.visible).toBe(false)
    expect(notebookRuntime.nodes.coverPivot.rotation.z).toBeGreaterThan(0)
    expect(notebookRuntime.nodes.coverPivot.rotation.z).toBeLessThan(
      NOTEBOOK_MODEL_SPEC.openAngle,
    )
    for (const progress of [0.42, 0.56, 0.7, 0.84]) {
      setOpenProgress(progress, true)
      expect(notebookRuntime.nodes.coverPivot.rotation.z).toBeCloseTo(
        NOTEBOOK_MODEL_SPEC.openAngle,
      )
      expect(notebookRuntime.nodes.rapidPageFlipPool.visible).toBe(true)
      const activePages = notebookRuntime.nodes.rapidPageFlipPool.children
        .filter((page) => page.visible)
      expect(activePages.length).toBeGreaterThan(0)
      expect(activePages.length).toBeLessThanOrEqual(2)
      for (const page of activePages) {
        expect(page.rotation.z).toBeGreaterThanOrEqual(0)
        expect(page.rotation.z).toBeLessThanOrEqual(
          NOTEBOOK_MODEL_SPEC.openAngle,
        )
      }
      expect(notebookRuntime.nodes.textBlock.scale.y).toBe(1)
      expect(notebookRuntime.nodes.textBlock.visible).toBe(true)
    }
    setOpenProgress(0.96, true)
    expect(notebookRuntime.nodes.rapidPageFlipPool.visible).toBe(false)
    expect(
      notebookRuntime.nodes.rapidPageFlipPool.children.every(
        (page) => !page.visible,
      ),
    ).toBe(true)
    setOpenProgress(-1)
    expect(getOpenProgress()).toBe(0)
    expect(notebookRuntime.nodes.coverPivot.rotation.z).toBe(0)
    expect(notebookRuntime.nodes.pagePivot.rotation.z).toBe(0)
    expect(notebookRuntime.nodes.coverPivot.position.toArray()).toEqual([
      ...NOTEBOOK_MODEL_SPEC.coverHinge,
    ])
    expect(notebookRuntime.nodes.pagePivot.position.toArray()).toEqual([
      ...NOTEBOOK_MODEL_SPEC.pageHinge,
    ])
    expect(notebookRuntime.nodes.textBlock.scale.y).toBe(1)
    expect(notebookRuntime.nodes.textBlock.visible).toBe(true)
    expect(notebookRuntime.nodes.spineCase.visible).toBe(true)
    expect(notebookRuntime.nodes.leftPages.visible).toBe(false)
    expect(notebookRuntime.nodes.rightPages.visible).toBe(false)
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
    expect(notebook.getObjectByName('continuous-ribbon-bookmark')).toBeUndefined()
    expect(notebookRuntime.nodes.rightTopPage.parent).toBeNull()
  })

  it('builds one closed text block and derives opening leaves separately', () => {
    const materials = createTestMaterials()
    const notebook = trackRoot(createNotebookModel(materials))
    const runtime = getRuntime<NotebookModelNodes>(notebook)
    expect(notebook.getObjectsByProperty('name', 'closed-text-block')).toHaveLength(1)
    expect(notebook.getObjectByName('right-page-stack')).toBeUndefined()
    expect(notebook.getObjectByName('left-page-stack')).toBeUndefined()

    for (const mesh of [runtime.nodes.textBlock, runtime.nodes.spineCase]) {
      mesh.geometry.computeBoundingBox()
      expect(mesh.geometry.boundingBox).not.toBeNull()
    }
    const textBlockSize = runtime.nodes.textBlock.geometry.boundingBox!.getSize(
      new THREE.Vector3(),
    )
    const spineSize = runtime.nodes.spineCase.geometry.boundingBox!.getSize(
      new THREE.Vector3(),
    )
    expect(textBlockSize.y).toBeCloseTo(NOTEBOOK_MODEL_SPEC.page.stackThickness)
    expect(spineSize.y).toBeCloseTo(
      NOTEBOOK_MODEL_SPEC.cover.thickness * 2 +
        NOTEBOOK_MODEL_SPEC.page.stackThickness,
    )
    expect(spineSize.z).toBeCloseTo(NOTEBOOK_MODEL_SPEC.cover.depth)
  })

  it('uses independent deterministic PBR channels for every surface family', () => {
    const materials = createTestMaterials()
    expect(materials.textureCount).toBe(16)
    expect(new Set(materials.textures).size).toBe(materials.textureCount)

    for (const family of ['wood', 'cloth', 'kraft', 'paper'] as const) {
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
      materials.notebookCover,
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
      materials.notebookCover,
      materials.notebookCoverDark,
      materials.neutral,
      materials.paper,
      materials.paperEdge,
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
