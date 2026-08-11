import * as THREE from 'three'

export const MODEL_BUILD_PASSES = [
  'blockout',
  'structural-pass',
  'form-refinement',
  'material-pass',
  'surface-pass',
  'lighting-pass',
  'interaction-pass',
  'optimization-pass',
] as const

export type ModelBuildPass = (typeof MODEL_BUILD_PASSES)[number]

export interface ModelFactoryOptions {
  castShadow?: boolean
  pass?: ModelBuildPass
  receiveShadow?: boolean
}

export interface SculptCollider {
  center: [number, number, number]
  id: string
  size: [number, number, number]
  type: 'box'
}

export interface SculptRuntime<TNodes extends Record<string, THREE.Object3D>> {
  colliders: Record<string, SculptCollider>
  destructionGroups: Record<string, THREE.Object3D[]>
  nodes: TNodes
  sockets: Record<string, THREE.Object3D>
}

export interface ModelResourceMetrics {
  drawCalls: number
  meshes: number
  shadowCasters: number
  textures: number
  triangles: number
}

export const isPassEnabled = (
  selected: ModelBuildPass,
  required: ModelBuildPass,
) => MODEL_BUILD_PASSES.indexOf(selected) >= MODEL_BUILD_PASSES.indexOf(required)

export function setSculptRuntime<TNodes extends Record<string, THREE.Object3D>>(
  root: THREE.Group,
  runtime: SculptRuntime<TNodes>,
) {
  root.userData.sculptRuntime = runtime
  return root
}

export function getSculptRuntime<
  TNodes extends Record<string, THREE.Object3D>,
>(root: THREE.Object3D): SculptRuntime<TNodes> {
  return root.userData.sculptRuntime as SculptRuntime<TNodes>
}

const geometryTriangles = (geometry: THREE.BufferGeometry) => {
  if (geometry.index) return geometry.index.count / 3
  const position = geometry.getAttribute('position')
  return position ? position.count / 3 : 0
}

export function measureModelResources(root: THREE.Object3D): ModelResourceMetrics {
  const textures = new Set<THREE.Texture>()
  const metrics: ModelResourceMetrics = {
    drawCalls: 0,
    meshes: 0,
    shadowCasters: 0,
    textures: 0,
    triangles: 0,
  }

  root.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return
    const instances = object instanceof THREE.InstancedMesh ? object.count : 1
    metrics.meshes += 1
    metrics.drawCalls += Array.isArray(object.material)
      ? object.material.length
      : 1
    metrics.triangles += geometryTriangles(object.geometry) * instances
    if (object.castShadow) metrics.shadowCasters += 1

    const materials = Array.isArray(object.material)
      ? object.material
      : [object.material]
    for (const material of materials) {
      for (const value of Object.values(material)) {
        if (value instanceof THREE.Texture) textures.add(value)
      }
    }
  })

  metrics.textures = textures.size
  return metrics
}

export function disposeModelGeometry(root: THREE.Object3D) {
  const geometries = new Set<THREE.BufferGeometry>()
  root.traverse((object) => {
    if (object instanceof THREE.Mesh) geometries.add(object.geometry)
  })
  geometries.forEach((geometry) => geometry.dispose())
}

export function markMesh(
  mesh: THREE.Mesh,
  id: string,
  options: ModelFactoryOptions,
) {
  const uv = mesh.geometry.getAttribute('uv')
  if (uv && !mesh.geometry.getAttribute('uv1')) {
    mesh.geometry.setAttribute('uv1', uv.clone())
  }
  mesh.name = id
  mesh.castShadow = options.castShadow ?? true
  mesh.receiveShadow = options.receiveShadow ?? true
  return mesh
}
