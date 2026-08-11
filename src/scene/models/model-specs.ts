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
    position: [0, -0.86, 3.62] as const,
    radius: 0.12,
    width: 11.36,
  },
  drawers: [
    { id: 'drawer-left', positionX: -4.05, width: 2.2 },
    { id: 'drawer-center', positionX: 0, width: 5.55 },
    { id: 'drawer-right', positionX: 4.05, width: 2.2 },
  ],
  drawerDepth: 0.18,
  drawerHeight: 0.64,
  drawerPositionY: -0.82,
  drawerPositionZ: 3.79,
  drawerRadius: 0.14,
  leg: {
    bottomRadius: 0.22,
    height: 2.96,
    positionY: -1.95,
    topRadius: 0.36,
  },
  legPositions: [
    [-5.08, -1.95, -3.08],
    [5.08, -1.95, -3.08],
    [-5.08, -1.95, 3.08],
    [5.08, -1.95, 3.08],
  ] as const,
  tabletop: {
    depth: 8,
    positionY: -0.24,
    radius: 0.3,
    thickness: 0.48,
    width: 12,
  },
} as const

export const DESK_MAT_MODEL_SPEC = {
  bindingInset: 0.16,
  bindingRadius: 0.045,
  depth: 6.25,
  planRadius: 0.55,
  position: [0, 0.055, 0.2] as const,
  stitchCount: 274,
  stitchInset: 0.27,
  thickness: 0.11,
  topY: 0.11,
  width: 8.7,
} as const

export const NOTEBOOK_MODEL_SPEC = {
  cover: {
    depth: 3.82,
    planRadius: 0.19,
    thickness: 0.14,
    width: 3.2,
  },
  coverHinge: [-1.5, 0.3, 0] as const,
  openAngle: Math.PI * 0.97,
  page: {
    depth: 3.54,
    planRadius: 0.15,
    stackThickness: 0.15,
    width: 2.92,
  },
  ribbon: {
    endZ: 2.38,
    startZ: -1.5,
    width: 0.12,
    worldX: -1.46,
  },
  rootPosition: [-0.65, 0.34, 0.25] as const,
} as const
