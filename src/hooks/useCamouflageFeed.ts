import { useCallback } from 'react'
import { fetchRecentCamouflages, type WtLiveFeedSort } from '../lib/wtLive'
import { useWtLiveFeed, type WtLiveFeedRequest } from './useWtLiveFeed'

type Options = {
  enabled: boolean
  query: string
  sort: WtLiveFeedSort
}

export function useCamouflageFeed({ enabled, query, sort }: Options) {
  const fetchPage = useCallback(
    ({ signal, searchTag, period, page, query: feedSort }: WtLiveFeedRequest<WtLiveFeedSort>) =>
      fetchRecentCamouflages(signal, searchTag, period, page, feedSort),
    [],
  )

  const {
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
    loadMore,
    retry,
    applySearchTag,
    changePeriod,
  } = useWtLiveFeed<WtLiveFeedSort>({
    enabled,
    searchQuery: query,
    initialSearchTag: '',
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
