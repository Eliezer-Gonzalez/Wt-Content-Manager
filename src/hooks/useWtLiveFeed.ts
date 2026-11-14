import { useCallback, useEffect, useRef, useState } from 'react'
import type { Period } from '../components/PeriodFilter'
import { useI18n } from '../i18n/I18nContext'
import { formatWtLiveError } from '../lib/appError'
import type { WtLiveItem } from '../lib/wtLive'

const DEFAULT_PAGE_SIZE = 25
const SEARCH_DEBOUNCE_MS = 350

export type WtLiveFeedRequest<TQuery> = {
  signal: AbortSignal
  searchTag: string
  period: Period
  page: number
  query: TQuery
}

export type UseWtLiveFeedOptions<TQuery> = {
  enabled?: boolean
  searchQuery: string
  initialSearchTag?: string
  initialPeriod?: Period
  pageSize?: number
  query: TQuery
  fetchPage: (request: WtLiveFeedRequest<TQuery>) => Promise<WtLiveItem[]>
}

/**
 * Shared WT Live feed controller with debounced search, pagination, abort handling, and deduplication.
 */
export function useWtLiveFeed<TQuery>({
  enabled = true,
  searchQuery,
  initialSearchTag = '',
  initialPeriod = 7,
  pageSize = DEFAULT_PAGE_SIZE,
  query,
  fetchPage,
}: UseWtLiveFeedOptions<TQuery>) {
  const { t } = useI18n()
  const [items, setItems] = useState<WtLiveItem[]>([])
  const [searchInput, setSearchInput] = useState(searchQuery)
  const [searchTag, setSearchTag] = useState(initialSearchTag)
  const [period, setPeriod] = useState<Period>(initialPeriod)
  const [page, setPage] = useState(0)
  const [hasNext, setHasNext] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState('')
  const [online, setOnline] = useState<boolean | null>(null)
  const [loadMoreError, setLoadMoreError] = useState('')
  const [retryCount, setRetryCount] = useState(0)
  const fetchRequestIdRef = useRef(0)
  const lastSearchRef = useRef(initialSearchTag)
  const fetchPageRef = useRef(fetchPage)
  const queryRef = useRef(query)

  useEffect(() => {
    fetchPageRef.current = fetchPage
    queryRef.current = query
  })

  useEffect(() => {
    setSearchInput(searchQuery)
  }, [searchQuery])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const next = searchInput.trim()
      if (next === lastSearchRef.current) return
      lastSearchRef.current = next
      // Reset the page together with the debounced query so only one fetch runs.
      setSearchTag(next)
      setPage(0)
    }, SEARCH_DEBOUNCE_MS)
    return () => window.clearTimeout(timer)
  }, [searchInput])

  const queryKey = typeof query === 'object' && query !== null ? JSON.stringify(query) : query

  useEffect(() => {
    if (!enabled) return
    const controller = new AbortController()
    const requestId = ++fetchRequestIdRef.current
    const isLoadingMore = page > 0
    if (isLoadingMore) {
      setLoadingMore(true)
      setLoadMoreError('')
    } else {
      setLoading(true)
      setError('')
      setLoadMoreError('')
      setHasNext(false)
    }

    fetchPageRef.current({
      signal: controller.signal,
      searchTag,
      period,
      page,
      query: queryRef.current,
    })
      .then(pageItems => {
        if (requestId !== fetchRequestIdRef.current) return
        setOnline(true)
        setItems(current => {
          if (page === 0) return pageItems
          const existingIds = new Set(current.map(item => item.id))
          return [...current, ...pageItems.filter(item => !existingIds.has(item.id))]
        })
        setHasNext(pageItems.length === pageSize)
      })
      .catch((cause: unknown) => {
        if (requestId !== fetchRequestIdRef.current) return
        if (!(cause instanceof Error && cause.name === 'AbortError')) {
          setOnline(false)
          const message = formatWtLiveError(cause, t)
          if (isLoadingMore) setLoadMoreError(message)
          else setError(message)
        }
      })
      .finally(() => {
        if (requestId !== fetchRequestIdRef.current || controller.signal.aborted) return
        setLoading(false)
        setLoadingMore(false)
      })
    return () => controller.abort()
  }, [enabled, searchTag, period, page, pageSize, retryCount, queryKey, t])

  const loadPage = useCallback((nextPage = 0) => {
    setPage(nextPage)
    if (nextPage === 0) {
      setHasNext(false)
      setLoadMoreError('')
    }
  }, [])

  const loadFirstPage = useCallback(() => setPage(0), [])

  const loadMore = useCallback(() => {
    setLoadingMore(true)
    setLoadMoreError('')
    setPage(current => current + 1)
  }, [])

  const retry = useCallback(() => {
    setRetryCount(current => current + 1)
  }, [])

  const applySearchTag = useCallback((tag: string) => {
    const next = tag.trim()
    lastSearchRef.current = next
    setSearchInput(next)
    setSearchTag(next)
    setPage(0)
    setHasNext(false)
    setLoadMoreError('')
  }, [])

  const changePeriod = useCallback((nextPeriod: Period) => {
    setPeriod(nextPeriod)
    setPage(0)
  }, [])

  return {
    items,
    loading,
    loadingMore,
    error,
    online,
    loadMoreError,
    page,
    hasNext,
    searchInput,
    setSearchInput,
    searchTag,
    period,
    loadPage,
    loadFirstPage,
    loadMore,
    retry,
    applySearchTag,
    changePeriod,
  }
}
