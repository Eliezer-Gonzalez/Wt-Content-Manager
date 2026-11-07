import { useCallback, useState } from 'react'

export type HomeSectionKey = 'recent' | 'installed' | 'favorites'
export type HomeSectionsMap = Record<HomeSectionKey, boolean>

const storageKey = 'wt-content-manager-home-sections-v1'
const defaultSections: HomeSectionsMap = { recent: true, installed: true, favorites: true }

function loadHomeSections(): HomeSectionsMap {
  try {
    const raw = localStorage.getItem(storageKey)
    if (!raw) return defaultSections
    const parsed = JSON.parse(raw) as Partial<HomeSectionsMap>
    return {
      recent: parsed.recent !== false,
      installed: parsed.installed !== false,
      favorites: parsed.favorites !== false,
    }
  } catch {
    return defaultSections
  }
}

export function useHomeSections() {
  const [visibleSections, setVisibleSections] = useState<HomeSectionsMap>(loadHomeSections)

  const updateSection = useCallback((key: HomeSectionKey, visible: boolean) => {
    setVisibleSections(current => {
      const next = { ...current, [key]: visible }
      try {
        localStorage.setItem(storageKey, JSON.stringify(next))
      } catch {
        /* Keep the choice for this session. */
      }
      return next
    })
  }, [])

  const hideSection = useCallback((key: HomeSectionKey) => updateSection(key, false), [updateSection])
  const showSection = useCallback((key: HomeSectionKey) => updateSection(key, true), [updateSection])

  return { visibleSections, hideSection, showSection }
}
