import { useCallback, useState } from 'react'
import type { ImageQualityMode } from '../lib/imageQuality'

const storageKey = 'wt-content-manager-image-quality-v1'

function readPreference(): ImageQualityMode | null {
  try {
    const value = localStorage.getItem(storageKey)
    return value === 'optimized' || value === 'high' ? value : null
  } catch {
    return null
  }
}

export function useImageQualityPreference() {
  const [storedQuality, setStoredQuality] = useState<ImageQualityMode | null>(readPreference)
  const setQuality = useCallback((quality: ImageQualityMode) => {
    setStoredQuality(quality)
    try {
      localStorage.setItem(storageKey, quality)
    } catch {
      // Keep the choice for this session when browser storage is unavailable.
    }
  }, [])

  return {
    quality: storedQuality ?? 'optimized',
    isSetupRequired: storedQuality === null,
    setQuality,
  }
}
