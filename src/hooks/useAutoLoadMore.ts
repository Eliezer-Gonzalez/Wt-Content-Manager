import { useEffect, useRef } from 'react'

type UseAutoLoadMoreOptions = {
  enabled: boolean
  onLoadMore: () => void
}

export function useAutoLoadMore<T extends HTMLElement = HTMLDivElement>({
  enabled,
  onLoadMore,
}: UseAutoLoadMoreOptions) {
  const ref = useRef<T | null>(null)
  const onLoadMoreRef = useRef(onLoadMore)

  useEffect(() => {
    onLoadMoreRef.current = onLoadMore
  })

  useEffect(() => {
    const node = ref.current
    if (!enabled || !node || typeof IntersectionObserver === 'undefined') return

    let triggered = false
    const observer = new IntersectionObserver(
      entries => {
        const entry = entries[0]
        if (!entry) return
        if (!entry.isIntersecting) {
          triggered = false
          return
        }
        if (!triggered) {
          triggered = true
          onLoadMoreRef.current()
        }
      },
      { rootMargin: '300px' },
    )

    observer.observe(node)
    return () => observer.disconnect()
  }, [enabled])

  return ref
}
