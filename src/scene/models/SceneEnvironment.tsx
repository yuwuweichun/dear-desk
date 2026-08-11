import { useThree } from '@react-three/fiber'
import { useEffect } from 'react'
import * as THREE from 'three'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'

interface SceneEnvironmentProps {
  intensity?: number
}

export function SceneEnvironment({ intensity = 0.32 }: SceneEnvironmentProps) {
  const get = useThree((state) => state.get)

  useEffect(() => {
    const { gl, scene } = get()
    const previousEnvironment = scene.environment
    const previousEnvironmentIntensity = scene.environmentIntensity
    const room = new RoomEnvironment()
    const generator = new THREE.PMREMGenerator(gl)
    const environment = generator.fromScene(room, 0.035).texture
    scene.environment = environment
    scene.environmentIntensity = intensity

    return () => {
      scene.environment = previousEnvironment
      scene.environmentIntensity = previousEnvironmentIntensity
      environment.dispose()
      generator.dispose()
      room.traverse((object) => {
        if (!(object instanceof THREE.Mesh)) return
        object.geometry.dispose()
        const materials = Array.isArray(object.material)
          ? object.material
          : [object.material]
        materials.forEach((material) => material.dispose())
      })
    }
  }, [get, intensity])

  return null
}
