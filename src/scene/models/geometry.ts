import * as THREE from 'three'

const roundedRectangleShape = (
  width: number,
  height: number,
  requestedRadius: number,
) => {
  const radius = Math.min(requestedRadius, width / 2, height / 2)
  const halfWidth = width / 2
  const halfHeight = height / 2
  const shape = new THREE.Shape()

  shape.moveTo(-halfWidth + radius, -halfHeight)
  shape.lineTo(halfWidth - radius, -halfHeight)
  shape.quadraticCurveTo(halfWidth, -halfHeight, halfWidth, -halfHeight + radius)
  shape.lineTo(halfWidth, halfHeight - radius)
  shape.quadraticCurveTo(halfWidth, halfHeight, halfWidth - radius, halfHeight)
  shape.lineTo(-halfWidth + radius, halfHeight)
  shape.quadraticCurveTo(-halfWidth, halfHeight, -halfWidth, halfHeight - radius)
  shape.lineTo(-halfWidth, -halfHeight + radius)
  shape.quadraticCurveTo(-halfWidth, -halfHeight, -halfWidth + radius, -halfHeight)
  return shape
}

export function createRoundedPanelGeometry(
  width: number,
  height: number,
  thickness: number,
  planRadius: number,
  bevel = Math.min(0.025, thickness * 0.18),
) {
  const bevelThickness = Math.min(bevel, thickness * 0.22)
  const geometry = new THREE.ExtrudeGeometry(
    roundedRectangleShape(width, height, planRadius),
    {
      bevelEnabled: bevelThickness > 0,
      bevelSegments: 2,
      bevelSize: bevelThickness,
      bevelThickness,
      curveSegments: 10,
      depth: Math.max(0.001, thickness - bevelThickness * 2),
      steps: 1,
    },
  )
  geometry.translate(0, 0, -thickness / 2 + bevelThickness)
  geometry.computeVertexNormals()
  geometry.userData.planRadius = planRadius
  geometry.userData.thickness = thickness
  return geometry
}

export function createRoundedPlateGeometry(
  width: number,
  depth: number,
  thickness: number,
  planRadius: number,
  bevel?: number,
) {
  const geometry = createRoundedPanelGeometry(
    width,
    depth,
    thickness,
    planRadius,
    bevel,
  )
  geometry.rotateX(Math.PI / 2)
  return geometry
}

export function createCurvedPageGeometry(
  width: number,
  depth: number,
  direction: -1 | 1,
) {
  const geometry = new THREE.PlaneGeometry(width, depth, 16, 20)
  const position = geometry.getAttribute('position')
  for (let index = 0; index < position.count; index += 1) {
    const x = position.getX(index)
    const y = position.getY(index)
    const edgeDistance = direction === 1 ? x + width / 2 : width / 2 - x
    const gutterCrown = 0.055 * Math.exp(-edgeDistance * 4.4)
    const foreEdgeLift = 0.018 * Math.pow(Math.abs(y) / (depth / 2), 3)
    const broadCrown = 0.018 * (1 - Math.pow((x * 2) / width, 2))
    position.setZ(index, gutterCrown + foreEdgeLift + broadCrown)
  }
  geometry.rotateX(-Math.PI / 2)
  geometry.computeVertexNormals()
  geometry.userData.curvedPage = true
  return geometry
}

export function createRibbonGeometry(
  width: number,
  startZ: number,
  endZ: number,
  thickness = 0.012,
) {
  const halfWidth = width / 2
  const notchDepth = width * 0.75
  const shape = new THREE.Shape()
  shape.moveTo(-halfWidth, startZ)
  shape.lineTo(halfWidth, startZ)
  shape.lineTo(halfWidth, endZ)
  shape.lineTo(0, endZ - notchDepth)
  shape.lineTo(-halfWidth, endZ)
  shape.closePath()
  const geometry = new THREE.ExtrudeGeometry(shape, {
    bevelEnabled: false,
    curveSegments: 1,
    depth: thickness,
    steps: 1,
  })
  geometry.translate(0, 0, -thickness / 2)
  geometry.rotateX(Math.PI / 2)
  geometry.computeVertexNormals()
  return geometry
}

export function createRoundedRectCurve(
  width: number,
  depth: number,
  radius: number,
  y = 0,
) {
  const halfWidth = width / 2
  const halfDepth = depth / 2
  const r = Math.min(radius, halfWidth, halfDepth)
  const curve = new THREE.CurvePath<THREE.Vector3>()
  const point = (x: number, z: number) => new THREE.Vector3(x, y, z)

  curve.add(new THREE.LineCurve3(point(-halfWidth + r, -halfDepth), point(halfWidth - r, -halfDepth)))
  curve.add(new THREE.QuadraticBezierCurve3(point(halfWidth - r, -halfDepth), point(halfWidth, -halfDepth), point(halfWidth, -halfDepth + r)))
  curve.add(new THREE.LineCurve3(point(halfWidth, -halfDepth + r), point(halfWidth, halfDepth - r)))
  curve.add(new THREE.QuadraticBezierCurve3(point(halfWidth, halfDepth - r), point(halfWidth, halfDepth), point(halfWidth - r, halfDepth)))
  curve.add(new THREE.LineCurve3(point(halfWidth - r, halfDepth), point(-halfWidth + r, halfDepth)))
  curve.add(new THREE.QuadraticBezierCurve3(point(-halfWidth + r, halfDepth), point(-halfWidth, halfDepth), point(-halfWidth, halfDepth - r)))
  curve.add(new THREE.LineCurve3(point(-halfWidth, halfDepth - r), point(-halfWidth, -halfDepth + r)))
  curve.add(new THREE.QuadraticBezierCurve3(point(-halfWidth, -halfDepth + r), point(-halfWidth, -halfDepth), point(-halfWidth + r, -halfDepth)))
  return curve
}

export function scaleGeometryUvs(
  geometry: THREE.BufferGeometry,
  scaleX: number,
  scaleY: number,
) {
  const uv = geometry.getAttribute('uv')
  if (!uv) return geometry
  for (let index = 0; index < uv.count; index += 1) {
    uv.setXY(index, uv.getX(index) * scaleX, uv.getY(index) * scaleY)
  }
  uv.needsUpdate = true
  return geometry
}
