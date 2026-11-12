export type WtLiveImage = {
  src: string
  fullResolutionSrc?: string
  thumbnailSrc?: string
  width?: number
  height?: number
  aspectRatio?: number
}

export type WtLiveBlock =
  | { type: 'text'; text: string; segments?: Array<{ text: string; url?: string }> }
  | { type: 'video'; url: string; title?: string }
  | ({ type: 'image'; alt: string } & WtLiveImage)

import { invoke } from '@tauri-apps/api/core'

export type WtLiveItem = {
  contentType?: 'camouflage' | 'sound'
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
  images: WtLiveImage[]
  stats?: Pick<WtLiveItem, 'likes' | 'downloads'>
}

export type WtLivePostReference = Pick<WtLiveItem, 'langGroup' | 'language'>

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

import {
  getFullResolutionImageUrl,
  mapPostImages,
  mapPost,
  type ApiPost,
} from './wtLiveParser'
import { parseDescription } from './wtLiveDescriptionParser'

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
  return fetchRecentContent('camouflage', 'fetch_recent_camouflages', signal, searchString, period, page, sort)
}

export async function fetchRecentSounds(
  signal?: AbortSignal,
  searchString = '',
  period = 0,
  page = 0,
  sort: WtLiveFeedSort = 'created',
): Promise<WtLiveItem[]> {
  return fetchRecentContent('sound', 'fetch_recent_sounds', signal, searchString, period, page, sort)
}

async function fetchRecentContent(
  content: 'camouflage' | 'sound',
  command: 'fetch_recent_camouflages' | 'fetch_recent_sounds',
  signal?: AbortSignal,
  searchString = '',
  period = 0,
  page = 0,
  sort: WtLiveFeedSort = 'created',
): Promise<WtLiveItem[]> {
  const result = isDesktop
    ? await invoke<FeedResponse>(command, { searchString, period, page, sort })
    : await post<FeedResponse>(
        '/api/feed/get_regular/',
        new URLSearchParams({
          content,
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
  const result = await fetchPost(item.langGroup, signal)
  return mapPostDetail(result, item)
}

export async function fetchLinkedPost(
  langGroup: number,
  language = 'en',
  signal?: AbortSignal,
): Promise<{ item: WtLiveItem; detail: WtLiveDetail }> {
  const result = await fetchPost(langGroup, signal)
  const item = mapPost(result)
  item.language = language
  return { item, detail: mapPostDetail(result, item) }
}

async function fetchPost(langGroup: number, signal?: AbortSignal): Promise<ApiPost> {
  return isDesktop
    ? invoke<ApiPost>('fetch_post_detail', { langGroup })
    : post<ApiPost>(
        '/api/posts/get/',
        new URLSearchParams({ lang_group: String(langGroup), language: '0' }),
        signal,
      )
}

function mapPostDetail(result: ApiPost, item: WtLiveItem): WtLiveDetail {
  const images = mapPostImages(result)
  const imageByUrl = new Map<string, WtLiveImage>()
  for (const image of images) {
    for (const url of [image.src, image.fullResolutionSrc, image.thumbnailSrc]) {
      if (url) imageByUrl.set(getFullResolutionImageUrl(url), image)
    }
  }
  const content = parseDescription(result.description)
  const description = content.blocks.map(block => {
    if (block.type !== 'image') return block
    const metadata = imageByUrl.get(getFullResolutionImageUrl(block.src))
    return metadata ? { ...block, ...metadata, alt: block.alt } : block
  })

  return {
    description,
    hashtags: content.hashtags,
    commentsUrl: `https://live.warthunder.com/post/${item.langGroup}/${item.language}/#comments`,
    images,
    stats: { likes: result.likes ?? item.likes, downloads: result.downloads ?? item.downloads },
  }
}

export function getWtLivePostReference(value: string): WtLivePostReference | null {
  try {
    const url = new URL(value)
    if (url.origin !== 'https://live.warthunder.com') return null
    const match = url.pathname.match(/^\/post\/(\d+)\/([a-z]{2})\/?$/i)
    if (!match) return null
    const langGroup = Number(match[1])
    if (!Number.isSafeInteger(langGroup) || langGroup <= 0) return null
    return { langGroup, language: match[2].toLowerCase() }
  } catch {
    return null
  }
}

export function getSafeExternalHttpsUrl(value: string): string | null {
  try {
    const url = new URL(value)
    if (url.protocol !== 'https:' || !url.hostname || url.username || url.password) return null
    return url.href
  } catch {
    return null
  }
}

export function getSafeCommentUrl(commentUrl?: string): string | null {
  if (!commentUrl) return null
  try {
    const url = new URL(commentUrl)
    if (url.origin !== 'https://live.warthunder.com' || !url.pathname.startsWith('/post/')) {
      return null
    }
    return url.href
  } catch {
    return null
  }
}



