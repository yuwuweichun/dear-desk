export const MODEL_LIMITS = {
  drawCalls: 45,
  shadowCastingLights: 1,
  textures: 16,
  triangles: 80_000,
} as const

export const DESK_MODEL_SPEC = {
  apron: {
    depth: 0.24,
    height: 0.86,
    position: [0, -0.7, 3.62] as const,
    radius: 0.14,
    width: 9.42,
  },
  drawers: [
    { id: 'drawer-left', positionX: -3.62, width: 2.02 },
    { id: 'drawer-center', positionX: 0, width: 4.82 },
    { id: 'drawer-right', positionX: 3.62, width: 2.02 },
  ],
  drawerDepth: 0.18,
  drawerHeight: 0.66,
  drawerPositionY: -0.65,
  drawerPositionZ: 3.79,
  drawerRadius: 0.16,
  leg: {
    bottomRadius: 0.22,
    height: 4.75,
    positionY: -2.645,
    topRadius: 0.36,
  },
  legPositions: [
    [-5.08, -2.645, -3.08],
    [5.08, -2.645, -3.08],
    [-5.08, -2.645, 3.48],
    [5.08, -2.645, 3.48],
  ] as const,
  tabletop: {
    curveSegments: 32,
    depth: 8,
    positionY: -0.12,
    radius: 0.52,
    thickness: 0.34,
    width: 12,
  },
} as const

export const DESK_MAT_MODEL_SPEC = {
  binding: {
    heightScale: 0.62,
    inset: 0.06,
    overlap: 0.035,
    radius: 0.06,
  },
  bodyThickness: 0.075,
  depth: 6.25,
  planRadius: 0.7,
  position: [0, 0.055, 0.2] as const,
  stitch: {
    count: 244,
    dashLength: 0.07,
    inset: 0.27,
    radius: 0.005,
  },
  surface: {
    bodyTopInset: 0.006,
    inset: 0.09,
    thickness: 0.025,
    uvScale: [2.8, 2.1] as const,
  },
  topY: 0.11,
  width: 8.7,
} as const

export const NOTEBOOK_MODEL_SPEC = {
  cover: {
    depth: (3.2 * 5) / 3,
    overhang: 0.13,
    planRadius: 0.2,
    seamInset: 0.075,
    thickness: 0.12,
    width: 3.2,
  },
  coverHinge: [-1.6, 0.48, 0] as const,
  deskRotation: [0, 0, 0] as const,
  openAngle: Math.PI,
  page: {
    depth: (3.2 * 5) / 3 - 0.28,
    foreEdgeInset: 0.18,
    headTailInset: 0.14,
    planRadius: 0.14,
    stackThickness: 0.24,
    width: 2.92,
  },
  pageHinge: [
    -1.4,
    0.25,
    0,
  ] as const,
  hardware: {
    plateDepth: 0.38,
    platePosition: [0, 0.082, -0.62] as const,
    plateRadius: 0.075,
    plateThickness: 0.034,
    plateWidth: 1.12,
    rivetOffsetX: 0.43,
    rivetRadius: 0.058,
  },
  rootPosition: [0, 0.34, DESK_MAT_MODEL_SPEC.position[2]] as const,
  spine: {
    innerInset: 0.1,
    shoulderOffset: 0.095,
    width: 0.32,
  },
} as const

export const STUDY_ROOM_MODEL_SPEC = {
  floorTopY: -5.025,
  wallTopY: 12.975,
  ceilingInset: 0.02,
  wallThickness: 0.12,
  interior: { width: 42, depth: 33 },
  window: {
    centerZ: -7.8,
    bottomY: -1.45,
    topY: 11.2,
    width: 10.3,
    frameDepth: 0.42,
    frameWidth: 0.28,
    sillDepth: 1.05,
    sillHeight: 0.22,
    sillOverhang: 0.68,
    apronHeight: 0.22,
    mullionWidth: 0.18,
  },
  baseboard: { capHeight: 0.12, capInset: 0.18, height: 0.94, depth: 0.26, inset: 0.13 },
  plankCount: 38,
  plankGap: 0.04,
  plankThickness: 0.04,
  textureResolution: 512,
  textureRepeat: {
    floor: [1, 2.5] as const,
    wall: [4, 3] as const,
  },
} as const
