export type WtLiveBlock =
  | { type: 'text'; text: string }
  | { type: 'image'; src: string; alt: string }

import { invoke } from '@tauri-apps/api/core'

export type WtLiveItem = {
  id: number
  langGroup: number
  language: string
  title: string
  description: string
  author: string
  createdAt: number
  imageUrl?: string
  imageAspectRatio?: number
  downloadUrl?: string
  fileName?: string
  likes: number
  downloads: number
}

export type WtLiveDetail = {
  description: WtLiveBlock[]
  hashtags: string[]
  commentsUrl: string
}

export type WtLiveFeedSort = 'created' | 'rating'

export class WtLiveError extends Error {
  readonly code: string
  readonly params?: Record<string, string | number>

  constructor(code: string, params?: Record<string, string | number>) {
    super(code)
    this.name = 'WtLiveError'
    this.code = code
    this.params = params
  }
}

export function formatErrorMessage(
  cause: unknown,
  t: (key: any, params?: Record<string, string | number>) => string,
): string {
  if (cause instanceof WtLiveError) {
    return t(`errors.${cause.code}`, cause.params)
  }
  if (cause instanceof Error) {
    return cause.message
  }
  return t('errors.unknown')
}

import { getFullResolutionImageUrl, mapPost, parseDescription, type ApiPost } from './lib/wtLiveParser'

export { getFullResolutionImageUrl }

type FeedResponse = { status: string; data?: { list?: ApiPost[] } }

const isDesktop = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window

async function post<T>(path: string, body: URLSearchParams, signal?: AbortSignal): Promise<T> {
  const response = await fetch(`https://live.warthunder.com${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
    signal,
  })
  if (!response.ok) {
    throw new WtLiveError('wt_live_http_error', { status: response.status })
  }
  return response.json() as Promise<T>
}

export async function fetchRecentCamouflages(
  signal?: AbortSignal,
  searchString = '',
  period = 0,
  page = 0,
  sort: WtLiveFeedSort = 'created',
): Promise<WtLiveItem[]> {
  const result = isDesktop
    ? await invoke<FeedResponse>('fetch_recent_camouflages', { searchString, period, page, sort })
    : await post<FeedResponse>(
        '/api/feed/get_regular/',
        new URLSearchParams({
          content: 'camouflage',
          sort,
          user: '',
          period: String(period),
          searchString,
          page: String(page),
          featured: 'false',
          subtype: 'all',
        }),
        signal,
      )
  if (result.status !== 'OK' || !Array.isArray(result.data?.list)) {
    throw new WtLiveError('wt_live_invalid_feed')
  }
  return result.data.list.map(mapPost)
}

export async function fetchPostDetail(item: WtLiveItem, signal?: AbortSignal): Promise<WtLiveDetail> {
  const result = isDesktop
    ? await invoke<ApiPost>('fetch_post_detail', { langGroup: item.langGroup })
    : await post<ApiPost>(
        '/api/posts/get/',
        new URLSearchParams({ lang_group: String(item.langGroup), language: '0' }),
        signal,
      )
  const content = parseDescription(result.description)
  return {
    description: content.blocks,
    hashtags: content.hashtags,
    commentsUrl: `https://live.warthunder.com/post/${item.langGroup}/${item.language}/#comments`,
  }
}



