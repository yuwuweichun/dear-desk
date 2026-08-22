import * as THREE from 'three'

import {
  CONTENT_FONT_FAMILIES,
  DEFAULT_CONTENT_FONT_ID,
  type ContentFontId,
} from '../domain/journal-font'
import { BRASS_MATERIAL_PARAMETERS } from './models/material-library'

const TEXTURE_WIDTH = 2048
const TEXTURE_HEIGHT = 512
const FONT_SIZE = 250
const MAX_TEXT_WIDTH = 1740
const PLAQUE_TOP_Y = 0.018
const NAMEPLATE_SURFACE_WIDTH = 1.08
const NAMEPLATE_SURFACE_DEPTH = 0.22
const GROOVE_DEPTH = 0.005

const createCanvasLayer = () => {
  const canvas = document.createElement('canvas')
  canvas.width = TEXTURE_WIDTH
  canvas.height = TEXTURE_HEIGHT
  return { canvas, context: canvas.getContext('2d') }
}

const configureText = (
  context: CanvasRenderingContext2D,
  contentFont: ContentFontId,
) => {
  context.textAlign = 'center'
  context.textBaseline = 'middle'
  context.font = `400 ${FONT_SIZE}px ${CONTENT_FONT_FAMILIES[contentFont]}`
}

const drawBrushedBase = (
  context: CanvasRenderingContext2D,
  base: string,
  alternate: string,
) => {
  context.fillStyle = base
  context.fillRect(0, 0, TEXTURE_WIDTH, TEXTURE_HEIGHT)
  context.fillStyle = alternate
  for (let y = 3; y < TEXTURE_HEIGHT; y += 8) {
    context.fillRect(0, y, TEXTURE_WIDTH, 1)
  }
}

const drawScaledLabel = (
  context: CanvasRenderingContext2D,
  label: string,
  scale: number,
  draw: () => void,
) => {
  context.save()
  context.translate(TEXTURE_WIDTH / 2, TEXTURE_HEIGHT / 2)
  context.scale(scale, scale)
  draw()
  context.restore()
}

const createTexture = (
  canvas: HTMLCanvasElement,
  name: string,
  colorSpace: THREE.ColorSpace = THREE.NoColorSpace,
) => {
  const texture = new THREE.CanvasTexture(canvas)
  texture.name = name
  texture.colorSpace = colorSpace
  texture.anisotropy = 8
  return texture
}

const drawEngravedLabel = (label: string, contentFont: ContentFontId) => {
  if (typeof document === 'undefined') return null
  const colorLayer = createCanvasLayer()
  const bumpLayer = createCanvasLayer()
  const roughnessLayer = createCanvasLayer()
  if (!colorLayer.context || !bumpLayer.context || !roughnessLayer.context) return null

  const contexts = [colorLayer.context, bumpLayer.context, roughnessLayer.context]
  contexts.forEach((context) => configureText(context, contentFont))
  const metrics = colorLayer.context.measureText(label)
  const scale = Math.min(1, MAX_TEXT_WIDTH / Math.max(metrics.width, 1))

  drawBrushedBase(colorLayer.context, '#ffffff', '#fdfcf9')
  drawScaledLabel(colorLayer.context, label, scale, () => {
    colorLayer.context!.strokeStyle = '#f2e7d7'
    colorLayer.context!.lineWidth = 7
    colorLayer.context!.strokeText(label, 0, 0)
    colorLayer.context!.fillStyle = '#d8c5ae'
    colorLayer.context!.fillText(label, 0, 0)
  })

  drawBrushedBase(bumpLayer.context, '#d8d8d8', '#d6d6d6')
  drawScaledLabel(bumpLayer.context, label, scale, () => {
    bumpLayer.context!.shadowColor = '#666666'
    bumpLayer.context!.shadowBlur = 7
    bumpLayer.context!.shadowOffsetX = 0
    bumpLayer.context!.shadowOffsetY = 0
    bumpLayer.context!.fillStyle = '#4c4c4c'
    bumpLayer.context!.fillText(label, 0, 0)
    bumpLayer.context!.shadowColor = 'transparent'
  })

  drawBrushedBase(roughnessLayer.context, '#575757', '#595959')
  drawScaledLabel(roughnessLayer.context, label, scale, () => {
    roughnessLayer.context!.strokeStyle = '#414141'
    roughnessLayer.context!.lineWidth = 8
    roughnessLayer.context!.strokeText(label, 0, 0)
    roughnessLayer.context!.fillStyle = '#909090'
    roughnessLayer.context!.fillText(label, 0, 0)
  })

  const colorTexture = createTexture(
    colorLayer.canvas,
    'nameplate-engraving-color',
    THREE.SRGBColorSpace,
  )
  const bumpTexture = createTexture(bumpLayer.canvas, 'nameplate-engraving-bump')
  const roughnessTexture = createTexture(
    roughnessLayer.canvas,
    'nameplate-engraving-roughness',
  )
  const material = new THREE.MeshPhysicalMaterial({
    ...BRASS_MATERIAL_PARAMETERS,
    bumpMap: bumpTexture,
    bumpScale: GROOVE_DEPTH,
    map: colorTexture,
    roughness: 1,
    roughnessMap: roughnessTexture,
  })
  material.name = 'dynamic-engraved-brass-surface'
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(NAMEPLATE_SURFACE_WIDTH, NAMEPLATE_SURFACE_DEPTH),
    material,
  )
  mesh.name = 'custom-nameplate-engraving'
  mesh.position.set(0, PLAQUE_TOP_Y, 0)
  mesh.rotation.x = -Math.PI / 2
  mesh.userData = {
    contentFont,
    engravingTechnique: 'bump-roughness',
    grooveDepth: GROOVE_DEPTH,
  }
  return mesh
}

export const loadNameplateFont = async (
  contentFont: ContentFontId,
  label: string,
) => {
  if (typeof document === 'undefined' || !document.fonts) return
  await document.fonts.load(
    `400 ${FONT_SIZE}px ${CONTENT_FONT_FAMILIES[contentFont]}`,
    label,
  )
}

export const createNameplateText = (
  label: string,
  contentFont: ContentFontId = DEFAULT_CONTENT_FONT_ID,
) => label ? drawEngravedLabel(label, contentFont) : null

export const disposeNameplateText = (mesh: THREE.Mesh) => {
  mesh.geometry.dispose()
  const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
  materials.forEach((candidate) => {
    const material = candidate as THREE.MeshPhysicalMaterial
    const textures = new Set([
      material.map,
      material.bumpMap,
      material.roughnessMap,
    ])
    textures.forEach((texture) => texture?.dispose())
    material.dispose()
  })
}
