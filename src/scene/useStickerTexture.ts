import { useEffect, useState } from 'react'
import * as THREE from 'three'

export function useStickerTexture(blob: Blob) {
  const [texture, setTexture] = useState<THREE.Texture | null>(null)

  useEffect(() => {
    const url = URL.createObjectURL(blob)
    let active = true
    let loaded: THREE.Texture | null = null
    new THREE.TextureLoader().load(
      url,
      (nextTexture) => {
        loaded = nextTexture
        nextTexture.colorSpace = THREE.SRGBColorSpace
        nextTexture.needsUpdate = true
        if (active) setTexture(nextTexture)
        else nextTexture.dispose()
      },
      undefined,
      () => {
        if (active) setTexture(null)
      },
    )
    return () => {
      active = false
      loaded?.dispose()
      URL.revokeObjectURL(url)
    }
  }, [blob])

  return texture
}
