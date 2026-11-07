import { useCallback, useEffect, useState } from 'react'
import { loadLocalLibrary, saveLocalLibrary, type InstalledSkin, type LocalLibrary } from '../lib/localLibrary'
import type { WtLiveItem } from '../wtLive'

export function useLocalLibrary() {
  const [library, setLibrary] = useState<LocalLibrary>(loadLocalLibrary)

  useEffect(() => saveLocalLibrary(library), [library])

  const toggleFavorite = useCallback((item: WtLiveItem) => {
    setLibrary(current => {
      const favorites = current.favorites.some(saved => saved.id === item.id)
        ? current.favorites.filter(saved => saved.id !== item.id)
        : [item, ...current.favorites]
      return { ...current, favorites }
    })
  }, [])

  const recordInstallation = useCallback((item: WtLiveItem, result: Omit<InstalledSkin, 'item' | 'installedAt'>) => {
    const entry: InstalledSkin = { ...result, item, installedAt: new Date().toISOString() }
    setLibrary(current => ({ ...current, installedSkins: [entry, ...current.installedSkins] }))
  }, [])

  return { favorites: library.favorites, installedSkins: library.installedSkins, toggleFavorite, recordInstallation }
}
