import { writeFileSync } from 'node:fs'
import * as THREE from 'three'

import { createDeskModel } from '../../../../src/scene/models/create-desk-model.ts'
import { createModelMaterialLibrary } from '../../../../src/scene/models/material-library.ts'

const outputRoot = new URL('./', import.meta.url)
const materials = createModelMaterialLibrary({ anisotropy: 1, textureSize: 16 })
const root = createDeskModel(materials)
root.updateMatrixWorld(true)

const parts: Array<Record<string, unknown>> = []
const meshes: Array<Record<string, unknown>> = []
let unnamedMeshes = 0
let integralMeshes = 0

root.traverse((object) => {
  if (object instanceof THREE.Group && object.name && object.userData.action) {
    parts.push({ kind: 'action-pivot', name: object.name, triangles: 0 })
  }
  if (!(object instanceof THREE.Mesh)) return
  if (!object.name) unnamedMeshes += 1
  const geometry = object.geometry
  const position = geometry.getAttribute('position')
  const indices = geometry.index
    ? Array.from(geometry.index.array, Number)
    : Array.from({ length: position.count }, (_, index) => index)
  const vertices = Array.from({ length: position.count }, (_, index) => [
    position.getX(index),
    position.getY(index),
    position.getZ(index),
  ])
  const normal = geometry.getAttribute('normal')
  const normals = normal
    ? Array.from({ length: normal.count }, (_, index) => [
        normal.getX(index),
        normal.getY(index),
        normal.getZ(index),
      ])
    : undefined
  const instanceCount = object instanceof THREE.InstancedMesh ? object.count : 1
  parts.push({
    kind: object instanceof THREE.InstancedMesh ? 'instanced-part' : 'part',
    name: object.name,
    triangles: Math.floor(indices.length / 3) * instanceCount,
  })
  meshes.push({ indices, name: object.name, normals, vertices })
})

for (const logicalPart of root.userData.logicalParts ?? []) {
  parts.push(logicalPart)
  if (logicalPart.kind === 'integral') integralMeshes += 1
}

writeFileSync(
  new URL('desk-parts-manifest.json', outputRoot),
  `${JSON.stringify({
    integralMeshes,
    model: root.userData.modelId,
    parts,
    unnamedMeshes,
  }, null, 2)}\n`,
)
writeFileSync(
  new URL('desk-meshes.json', outputRoot),
  `${JSON.stringify({ meshes }, null, 2)}\n`,
)

root.userData.dispose?.()
materials.dispose()
