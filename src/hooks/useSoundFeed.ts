import { useCallback } from 'react'
import { fetchRecentSounds, type WtLiveFeedSort } from '../lib/wtLive'
import { useWtLiveFeed, type WtLiveFeedRequest } from './useWtLiveFeed'

export function useSoundFeed(query: string, sort: WtLiveFeedSort) {
  const fetchPage = useCallback(
    ({ signal, searchTag, period, page, query: feedSort }: WtLiveFeedRequest<WtLiveFeedSort>) =>
      fetchRecentSounds(signal, searchTag, period, page, feedSort),
    [],
  )

  const {
    items,
    loading,
    loadingMore,
    error,
    online,
    loadMoreError,
    hasNext,
    retry,
    loadMore,
    period,
    changePeriod,
    loadFirstPage,
  } = useWtLiveFeed<WtLiveFeedSort>({
    searchQuery: query,
    initialSearchTag: query,
    query: sort,
    fetchPage,
  })

  return {
    items,
    loading,
    loadingMore,
    error,
    online,
    loadMoreError,
    hasNext,
    retry,
    loadMore,
    period,
    changePeriod,
    loadFirstPage,
  }
}
