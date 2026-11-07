import { useState } from 'react'

type SearchState = Record<string, string>
const storageKey = 'wt-content-manager-searches'

function readSearchState(): SearchState {
  try {
    const saved = localStorage.getItem(storageKey)
    const value: unknown = saved ? JSON.parse(saved) : {}
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
    return Object.fromEntries(Object.entries(value).filter((entry): entry is [string, string] => typeof entry[1] === 'string'))
  } catch {
    return {}
  }
}

export function useSectionSearch() {
  const [searches, setSearches] = useState<SearchState>(readSearchState)

  function setSearch(section: string, value: string) {
    const normalized = section === 'camouflages' && value && !value.startsWith('#')
      ? `#${value}`
      : value
    setSearches(current => {
      const updated = { ...current, [section]: normalized }
      try { localStorage.setItem(storageKey, JSON.stringify(updated)) } catch { /* Storage can be unavailable. */ }
      return updated
    })
  }

  return { searches, setSearch }
}
