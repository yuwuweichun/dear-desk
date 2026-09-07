import * as THREE from 'three'

export const FREE_ORBIT_MIN_POLAR_ANGLE = 0.22
export const FREE_ORBIT_MAX_POLAR_ANGLE = Math.PI / 2 - 0.08

const clamp = (value: number) => Math.min(Math.max(value, -1), 1)

export const getFreeOrbitPolarLimits = (
  position: THREE.Vector3,
  target: THREE.Vector3,
  floorY: number,
  ceilingY: number,
) => {
  const radius = position.distanceTo(target)
  if (radius === 0) {
    return { min: FREE_ORBIT_MIN_POLAR_ANGLE, max: FREE_ORBIT_MAX_POLAR_ANGLE }
  }
  return {
    min: Math.max(
      FREE_ORBIT_MIN_POLAR_ANGLE,
      Math.acos(clamp((ceilingY - target.y) / radius)),
    ),
    max: Math.min(
      FREE_ORBIT_MAX_POLAR_ANGLE,
      Math.acos(clamp((floorY - target.y) / radius)),
    ),
  }
}

export const isOrbitPathInsideRoom = (
  position: THREE.Vector3,
  target: THREE.Vector3,
  roomWidth: number,
  roomDepth: number,
) => {
  const radius = position.distanceTo(target)
  return (
    Math.abs(target.x) + radius <= roomWidth / 2 &&
    Math.abs(target.z) + radius <= roomDepth / 2
  )
}
