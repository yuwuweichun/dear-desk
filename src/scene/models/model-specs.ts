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
    depth: 8,
    positionY: -0.12,
    radius: 0.52,
    thickness: 0.34,
    width: 12,
  },
} as const

export const DESK_MAT_MODEL_SPEC = {
  bindingInset: 0.16,
  bindingRadius: 0.045,
  depth: 6.25,
  planRadius: 0.7,
  position: [0, 0.055, 0.2] as const,
  stitchCount: 274,
  stitchInset: 0.27,
  thickness: 0.11,
  topY: 0.11,
  width: 8.7,
} as const

export const NOTEBOOK_MODEL_SPEC = {
  cover: {
    depth: (3.2 * 5) / 3,
    overhang: 0.13,
    planRadius: 0.12,
    thickness: 0.055,
    width: 3.2,
  },
  coverHinge: [-1.6, 0.2925, 0] as const,
  deskRotation: [0, 0, 0] as const,
  joint: {
    axisX: -1.38,
    inset: 0.16,
    width: 0.018,
  },
  openAngle: Math.PI * 0.97,
  page: {
    depth: (3.2 * 5) / 3 - 0.28,
    foreEdgeInset: 0.18,
    headTailInset: 0.14,
    planRadius: 0.08,
    stackThickness: 0.21,
    width: 2.92,
  },
  pageHinge: [
    -1.4,
    0.2365,
    0,
  ] as const,
  rootPosition: [0, 0.34, DESK_MAT_MODEL_SPEC.position[2]] as const,
  spine: {
    depth: (3.2 * 5) / 3,
    width: 0.05,
  },
} as const
