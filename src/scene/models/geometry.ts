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
  curveSegments = 10,
) {
  const bevelThickness = Math.min(bevel, thickness * 0.22)
  const geometry = new THREE.ExtrudeGeometry(
    roundedRectangleShape(width, height, planRadius),
    {
      bevelEnabled: bevelThickness > 0,
      bevelSegments: 2,
      bevelSize: bevelThickness,
      bevelThickness,
      curveSegments,
      depth: Math.max(0.001, thickness - bevelThickness * 2),
      steps: 1,
    },
  )
  geometry.translate(0, 0, -thickness / 2 + bevelThickness)
  geometry.computeVertexNormals()
  geometry.userData.planRadius = planRadius
  geometry.userData.thickness = thickness
  geometry.userData.curveSegments = curveSegments
  return geometry
}

export function createRoundedPlateGeometry(
  width: number,
  depth: number,
  thickness: number,
  planRadius: number,
  bevel?: number,
  curveSegments?: number,
) {
  const geometry = createRoundedPanelGeometry(
    width,
    depth,
    thickness,
    planRadius,
    bevel,
    curveSegments,
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
    const pageRootLift = 0.065 * (
      1 - THREE.MathUtils.smoothstep(edgeDistance, 0, width * 0.42)
    )
    const headTailLift = 0.016 * Math.pow(Math.abs(y) / (depth / 2), 3)
    const broadCrown = 0.025 * (1 - Math.pow((x * 2) / width, 2))
    position.setZ(index, pageRootLift + headTailLift + broadCrown)
  }
  geometry.rotateX(-Math.PI / 2)
  geometry.computeVertexNormals()
  geometry.userData.curvedPage = true
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

export function createChamferedFrameGeometry(
  width: number,
  depth: number,
  chamfer: number,
  strokeWidth: number,
  y = 0,
) {
  const halfStroke = strokeWidth / 2
  const createPoints = (
    halfWidth: number,
    halfDepth: number,
    requestedCut: number,
  ) => {
    const cut = Math.min(requestedCut, halfWidth, halfDepth)
    return [
      [-halfWidth + cut, -halfDepth],
      [halfWidth - cut, -halfDepth],
      [halfWidth, -halfDepth + cut],
      [halfWidth, halfDepth - cut],
      [halfWidth - cut, halfDepth],
      [-halfWidth + cut, halfDepth],
      [-halfWidth, halfDepth - cut],
      [-halfWidth, -halfDepth + cut],
    ] as const
  }
  const outer = createPoints(
    width / 2 + halfStroke,
    depth / 2 + halfStroke,
    chamfer + halfStroke,
  )
  const inner = createPoints(
    width / 2 - halfStroke,
    depth / 2 - halfStroke,
    Math.max(0, chamfer - halfStroke),
  )
  const positions: number[] = []
  const uvs: number[] = []
  for (const loop of [outer, inner]) {
    for (const [x, z] of loop) {
      positions.push(x, y, z)
      uvs.push(x / (width + strokeWidth) + 0.5, z / (depth + strokeWidth) + 0.5)
    }
  }
  const indices: number[] = []
  for (let corner = 0; corner < 8; corner += 1) {
    const next = (corner + 1) % 8
    indices.push(corner, 8 + next, next, corner, 8 + corner, 8 + next)
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  geometry.computeBoundingBox()
  geometry.computeBoundingSphere()
  geometry.userData = {
    cornerCount: 4,
    cornerStyle: 'symmetric-chamfer',
    fixedCornerVertices: true,
    strokeWidth,
  }
  return geometry
}

interface ContinuousCaseGeometryOptions {
  coverDepth: number
  coverPlanRadius: number
  coverThickness: number
  coverWidth: number
  innerSpineInset: number
  spineWidth: number
  totalHeight: number
}

interface CaseProfilePoint {
  frontWeight: number
  x: number
  y: number
}

export function createContinuousCaseGeometry({
  coverDepth,
  coverPlanRadius,
  coverThickness,
  coverWidth,
  innerSpineInset,
  spineWidth,
  totalHeight,
}: ContinuousCaseGeometryOptions) {
  const coverLeft = -coverWidth / 2
  const coverRight = coverWidth / 2
  const outerLeft = coverLeft - spineWidth / 2
  const innerLeft = coverLeft - innerSpineInset
  const frontBottom = totalHeight - coverThickness
  const middle = totalHeight / 2
  const profile: CaseProfilePoint[] = [
    { frontWeight: 0, x: coverRight, y: 0 },
    { frontWeight: 0, x: coverLeft, y: 0 },
  ]
  const appendCubic = (
    start: THREE.Vector2,
    controlA: THREE.Vector2,
    controlB: THREE.Vector2,
    end: THREE.Vector2,
    segments: number,
    startWeight: number,
    endWeight: number,
  ) => {
    const curve = new THREE.CubicBezierCurve(start, controlA, controlB, end)
    for (let step = 1; step <= segments; step += 1) {
      const point = curve.getPoint(step / segments)
      profile.push({
        frontWeight: THREE.MathUtils.lerp(startWeight, endWeight, step / segments),
        x: point.x,
        y: point.y,
      })
    }
  }
  appendCubic(
    new THREE.Vector2(coverLeft, 0),
    new THREE.Vector2(outerLeft, 0),
    new THREE.Vector2(outerLeft, middle * 0.48),
    new THREE.Vector2(outerLeft, middle),
    10,
    0,
    0,
  )
  appendCubic(
    new THREE.Vector2(outerLeft, middle),
    new THREE.Vector2(outerLeft, middle * 1.52),
    new THREE.Vector2(outerLeft, totalHeight),
    new THREE.Vector2(coverLeft, totalHeight),
    10,
    0,
    1,
  )
  profile.push(
    { frontWeight: 1, x: coverRight, y: totalHeight },
    { frontWeight: 1, x: coverRight, y: frontBottom },
    { frontWeight: 1, x: coverLeft, y: frontBottom },
  )
  appendCubic(
    new THREE.Vector2(coverLeft, frontBottom),
    new THREE.Vector2(innerLeft, frontBottom - 0.035),
    new THREE.Vector2(innerLeft, middle + 0.045),
    new THREE.Vector2(innerLeft, middle),
    8,
    1,
    0,
  )
  appendCubic(
    new THREE.Vector2(innerLeft, middle),
    new THREE.Vector2(innerLeft, middle - 0.045),
    new THREE.Vector2(innerLeft, coverThickness + 0.035),
    new THREE.Vector2(coverLeft, coverThickness),
    8,
    0,
    0,
  )
  profile.push(
    { frontWeight: 0, x: coverRight, y: coverThickness },
  )

  const depthSegments = 96
  const ringSize = profile.length
  const positions: number[] = []
  const uvs: number[] = []
  const frontVertexIndices: number[] = []
  const frontVertexWeights: number[] = []
  const halfDepth = coverDepth / 2
  const planRadius = Math.min(coverPlanRadius, halfDepth, coverWidth / 2)
  for (let ring = 0; ring <= depthSegments; ring += 1) {
    const z = THREE.MathUtils.lerp(-halfDepth, halfDepth, ring / depthSegments)
    const endDistance = halfDepth - Math.abs(z)
    const circleOffset = Math.max(0, planRadius - endDistance)
    const rightInset =
      circleOffset > 0
        ? planRadius - Math.sqrt(Math.max(0, planRadius ** 2 - circleOffset ** 2))
        : 0
    for (const point of profile) {
      const x = point.x === coverRight ? point.x - rightInset : point.x
      const vertexIndex = positions.length / 3
      positions.push(x, point.y, z)
      uvs.push(
        ((x - outerLeft) / (coverRight - outerLeft)) * 1.15,
        ((z + halfDepth) / coverDepth) * 1.9,
      )
      if (point.frontWeight > 0) {
        frontVertexIndices.push(vertexIndex)
        frontVertexWeights.push(point.frontWeight)
      }
    }
  }

  const indices: number[] = []
  for (let ring = 0; ring < depthSegments; ring += 1) {
    for (let edge = 0; edge < ringSize; edge += 1) {
      const a = ring * ringSize + edge
      const b = ring * ringSize + ((edge + 1) % ringSize)
      const c = (ring + 1) * ringSize + ((edge + 1) % ringSize)
      const d = (ring + 1) * ringSize + edge
      indices.push(a, c, b, a, d, c)
    }
  }

  const contour = profile.map(({ x, y }) => new THREE.Vector2(x, y))
  const capTriangles = THREE.ShapeUtils.triangulateShape(contour, [])
  const addCap = (ring: number, desiredNormal: -1 | 1) => {
    // End caps get their own vertices so their planar normals do not bleed into
    // the rounded side profile and widen the edge highlight.
    const capVertexIndices = new Map<number, number>()
    const capVertex = (sourceIndex: number) => {
      const existing = capVertexIndices.get(sourceIndex)
      if (existing !== undefined) return existing
      const offset = sourceIndex * 3
      const uvOffset = sourceIndex * 2
      const nextIndex = positions.length / 3
      positions.push(positions[offset]!, positions[offset + 1]!, positions[offset + 2]!)
      uvs.push(uvs[uvOffset]!, uvs[uvOffset + 1]!)
      const sourceFrontIndex = frontVertexIndices.indexOf(sourceIndex)
      if (sourceFrontIndex >= 0) {
        frontVertexIndices.push(nextIndex)
        frontVertexWeights.push(frontVertexWeights[sourceFrontIndex]!)
      }
      capVertexIndices.set(sourceIndex, nextIndex)
      return nextIndex
    }
    for (const triangle of capTriangles) {
      const a = triangle[0]!
      const b = triangle[1]!
      const c = triangle[2]!
      const pointA = contour[a]!
      const pointB = contour[b]!
      const pointC = contour[c]!
      const cross =
        (pointB.x - pointA.x) * (pointC.y - pointA.y) -
        (pointB.y - pointA.y) * (pointC.x - pointA.x)
      const vertices = [
        capVertex(ring * ringSize + a),
        capVertex(ring * ringSize + b),
        capVertex(ring * ringSize + c),
      ]
      if (Math.sign(cross) === desiredNormal) indices.push(...vertices)
      else indices.push(vertices[0]!, vertices[2]!, vertices[1]!)
    }
  }
  addCap(0, -1)
  addCap(depthSegments, 1)

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  geometry.computeBoundingBox()
  geometry.computeBoundingSphere()
  geometry.userData = {
    frontVertexIndices,
    frontVertexWeights,
    planarUvRepeat: [1.15, 1.9],
    profile: 'single-continuous-rounded-case',
    singleShell: true,
  }
  return geometry
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
