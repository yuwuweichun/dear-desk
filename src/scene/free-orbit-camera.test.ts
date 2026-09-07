import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { getFreeOrbitPolarLimits, isOrbitPathInsideRoom } from './free-orbit-camera'

const poses = [
  [[6.7, 7.7, 11.5], [0, -0.45, 0.15]],
  [[8.9, 5.7, 11.3], [0, -0.9, 0.2]],
  [[0.1, 6.5, 16.2], [0, 3.5, 0.15]],
  [[0.15, 5.5, 15.2], [0, 2.5, 0.15]],
  [[0, 10.6, 6.2], [0, 0.22, 0.2]],
  [[0, 8.6, 5.1], [0, 0.22, 0.2]],
] as const

describe('free orbit camera bounds', () => {
  it('keeps every preset orbit inside the room and below the ceiling', () => {
    for (const [position, target] of poses) {
      const cameraPosition = new THREE.Vector3(...position)
      const cameraTarget = new THREE.Vector3(...target)
      const limits = getFreeOrbitPolarLimits(cameraPosition, cameraTarget, -5.025, 12.955)

      expect(isOrbitPathInsideRoom(cameraPosition, cameraTarget, 42, 33)).toBe(true)
      expect(limits.min).toBeLessThanOrEqual(limits.max)
      expect(cameraTarget.y + cameraPosition.distanceTo(cameraTarget) * Math.cos(limits.min)).toBeLessThanOrEqual(12.955)
    }
  })
})
