import { useState } from 'react'

export type PostLayout = 'justified' | 'masonry'

const storageKey = 'wt-content-manager-post-layout'

function getSavedLayout(): PostLayout {
  try {
    return localStorage.getItem(storageKey) === 'justified' ? 'justified' : 'masonry'
  } catch {
    return 'masonry'
  }
}

export function usePostLayout() {
  const [layout, setLayout] = useState<PostLayout>(getSavedLayout)

  function updateLayout(next: PostLayout) {
    setLayout(next)
    try { localStorage.setItem(storageKey, next) } catch { /* Keep the choice for this session. */ }
  }

  return [layout, updateLayout] as const
}
