import { useCallback, useEffect, useRef, useState } from 'react'
import { fetchRecentSounds, type WtLiveFeedSort, type WtLiveItem } from '../lib/wtLive'
import { formatWtLiveError } from '../lib/appError'
import { useI18n } from '../i18n/I18nProvider'
import type { Period } from '../components/PeriodFilter'

export function useSoundFeed(query: string, sort: WtLiveFeedSort) {
  const { t } = useI18n()
  const [items, setItems] = useState<WtLiveItem[]>([])
  const [searchTag, setSearchTag] = useState(query)
  const [period, setPeriod] = useState<Period>(7)
  const [page, setPage] = useState(0)
  const [hasNext, setHasNext] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState('')
  const [online, setOnline] = useState<boolean | null>(null)
  const [loadMoreError, setLoadMoreError] = useState('')
  const [retryCount, setRetryCount] = useState(0)
  const requestId = useRef(0)

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearchTag(query.trim())
      setPage(0)
    }, 350)
    return () => window.clearTimeout(timer)
  }, [query])

  useEffect(() => {
    const controller = new AbortController()
    const currentRequest = ++requestId.current
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

    fetchRecentSounds(controller.signal, searchTag, period, page, sort)
      .then(pageItems => {
        if (currentRequest !== requestId.current) return
        setOnline(true)
        setItems(current => {
          if (page === 0) return pageItems
          const existingIds = new Set(current.map(item => item.id))
          return [...current, ...pageItems.filter(item => !existingIds.has(item.id))]
        })
        setHasNext(pageItems.length === 25)
      })
      .catch((cause: unknown) => {
        if (currentRequest !== requestId.current) return
        if (!(cause instanceof Error && cause.name === 'AbortError')) {
          setOnline(false)
          const message = formatWtLiveError(cause, t)
          if (isLoadingMore) setLoadMoreError(message)
          else setError(message)
        }
      })
      .finally(() => {
        if (currentRequest !== requestId.current || controller.signal.aborted) return
        setLoading(false)
        setLoadingMore(false)
      })
    return () => controller.abort()
  }, [page, period, retryCount, searchTag, sort, t])

  const retry = useCallback(() => setRetryCount(count => count + 1), [])
  const loadMore = useCallback(() => {
    setLoadingMore(true)
    setLoadMoreError('')
    setPage(current => current + 1)
  }, [])
  const changePeriod = useCallback((nextPeriod: Period) => {
    setPeriod(nextPeriod)
    setPage(0)
  }, [])
  const loadFirstPage = useCallback(() => setPage(0), [])

  return { items, loading, loadingMore, error, online, loadMoreError, hasNext, retry, loadMore, period, changePeriod, loadFirstPage }
}
