import { useCallback, useEffect, useRef, useState } from 'react'
import { fetchRecentCamouflages, type WtLiveFeedSort, type WtLiveItem } from '../lib/wtLive'
import { formatAppError } from '../lib/appError'
import { useI18n } from '../i18n/I18nProvider'
import type { Period } from '../components/PeriodFilter'

type Options = {
  enabled: boolean
  query: string
  sort: WtLiveFeedSort
}

export function useCamouflageFeed({ enabled, query, sort }: Options) {
  const { t } = useI18n()
  const [items, setItems] = useState<WtLiveItem[]>([])
  const [searchInput, setSearchInput] = useState(query)
  const [searchTag, setSearchTag] = useState('')
  const [period, setPeriod] = useState<Period>(7)
  const [page, setPage] = useState(0)
  const [hasNext, setHasNext] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState('')
  const [loadMoreError, setLoadMoreError] = useState('')
  const [retryCount, setRetryCount] = useState(0)
  const fetchRequestIdRef = useRef(0)
  const lastSearchRef = useRef('')

  useEffect(() => {
    setSearchInput(query)
  }, [query])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const next = searchInput.trim()
      if (next === lastSearchRef.current) return
      lastSearchRef.current = next
      // Reset the page together with the debounced query so only one fetch runs.
      setSearchTag(next)
      setPage(0)
    }, 350)
    return () => window.clearTimeout(timer)
  }, [searchInput])

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
    fetchRecentCamouflages(controller.signal, searchTag, period, page, sort)
      .then(pageItems => {
        if (requestId !== fetchRequestIdRef.current) return
        setItems(current => {
          if (page === 0) return pageItems
          const existingIds = new Set(current.map(item => item.id))
          return [...current, ...pageItems.filter(item => !existingIds.has(item.id))]
        })
        setHasNext(pageItems.length === 25)
      })
      .catch((cause: unknown) => {
        if (requestId !== fetchRequestIdRef.current) return
        if (!(cause instanceof Error && cause.name === 'AbortError')) {
          const formatted = formatAppError(cause, t)
          const message = formatted.detail ? `${formatted.message} (${formatted.detail})` : formatted.message
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
  }, [enabled, searchTag, period, page, retryCount, sort, t])

  const loadPage = useCallback((nextPage = 0) => {
    setPage(nextPage)
    if (nextPage === 0) {
      setHasNext(false)
      setLoadMoreError('')
    }
  }, [])

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
    loadMoreError,
    page,
    hasNext,
    searchInput,
    setSearchInput,
    searchTag,
    period,
    loadPage,
    loadMore,
    retry,
    applySearchTag,
    changePeriod,
  }
}
