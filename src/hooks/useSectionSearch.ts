import { useEffect, useState } from 'react'

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
    setSearches(current => ({ ...current, [section]: normalized }))
  }

  useEffect(() => {
    try { localStorage.setItem(storageKey, JSON.stringify(searches)) } catch { /* Storage can be unavailable. */ }
  }, [searches])

  return { searches, setSearch }
}
