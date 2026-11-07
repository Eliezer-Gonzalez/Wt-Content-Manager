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

type ApiPost = {
  id: number
  lang_group: number
  language: string
  type: string
  created: number
  author?: { nickname?: string }
  likes?: number
  downloads?: number
  description?: string
  images?: Array<{ src?: string; orig?: string; mq?: string; width?: number; height?: number; ratio?: number | string }>
  file?: { name?: string; link?: string }
}

type FeedResponse = { status: string; data?: { list?: ApiPost[] } }

function plainText(markup = ''): string {
  const document = new DOMParser().parseFromString(markup, 'text/html')
  return (document.body.textContent ?? '').replace(/\s+/g, ' ').trim()
}

function mapPost(post: ApiPost): WtLiveItem {
  const description = plainText(post.description)
  const fileName = post.file?.name
  const image = post.images?.[0]
  const reportedRatio = Number(image?.ratio)
  const imageAspectRatio = reportedRatio > 0 ? reportedRatio : (image?.width && image.height ? image.width / image.height : undefined)
  const readableDescription = description.replace(/#[\p{L}\p{N}_-]+/gu, ' ').replace(/\s+/g, ' ').trim()
  const title = readableDescription.split(/[.!?\n]/, 1)[0]?.trim() || fileName || `Publicación ${post.id}`
  return {
    id: post.id,
    langGroup: post.lang_group,
    language: post.language,
    title: title.length > 72 ? `${title.slice(0, 69)}…` : title,
    description,
    author: post.author?.nickname || 'Autor desconocido',
    createdAt: post.created,
    imageUrl: safeImageUrl(image?.orig || image?.src || image?.mq),
    imageAspectRatio: imageAspectRatio && Number.isFinite(imageAspectRatio) && imageAspectRatio > 0 ? imageAspectRatio : undefined,
    downloadUrl: post.file?.link,
    fileName,
    likes: post.likes ?? 0,
    downloads: post.downloads ?? 0,
  }
}

export function getFullResolutionImageUrl(value: string): string {
  return safeImageUrl(value.replace('_lq/', '/')) ?? value
}

function safeImageUrl(value: string | null | undefined): string | undefined {
  if (!value) return undefined
  try {
    const url = new URL(value, 'https://live.warthunder.com')
    return url.protocol === 'https:' && (url.hostname === 'warthunder.com' || url.hostname.endsWith('.warthunder.com')) ? url.href : undefined
  } catch {
    return undefined
  }
}

function largestSrcsetImage(value: string | null): string | undefined {
  if (!value) return undefined
  const candidates = value.split(',').flatMap(candidate => {
    const [url, descriptor = '1x'] = candidate.trim().split(/\s+/, 2)
    const resolution = Number.parseFloat(descriptor)
    return url && Number.isFinite(resolution) ? [{ url, resolution }] : []
  })
  return candidates.sort((a, b) => b.resolution - a.resolution)[0]?.url
}

function parseDescription(markup = ''): { blocks: WtLiveBlock[]; hashtags: string[] } {
  const document = new DOMParser().parseFromString(markup, 'text/html')
  const blocks: WtLiveBlock[] = []
  const hashtags = new Map<string, string>()
  let text = ''
  const flush = () => {
    const raw = text.replace(/\s+/g, ' ').trim()
    text = ''
    if (!raw) return
    for (const match of raw.matchAll(/#[\p{L}\p{N}_-]+/gu)) {
      const tag = match[0].slice(1)
      if (!hashtags.has(tag.toLowerCase())) hashtags.set(tag.toLowerCase(), tag)
    }
    const value = raw.replace(/#[\p{L}\p{N}_-]+/gu, ' ').replace(/\s+([,.;:!?])/g, '$1').replace(/\s+/g, ' ').trim()
    if (value) blocks.push({ type: 'text', text: value })
  }
  const walk = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      text += node.textContent ?? ''
      return
    }
    if (!(node instanceof Element)) return
    if (node.tagName === 'IMG') {
      flush()
      const link = node.closest('a')?.getAttribute('href')
      const linkedSrc = safeImageUrl(link)
      const linkedUrl = linkedSrc ? new URL(linkedSrc) : null
      const linkLooksLikeImage = linkedUrl && (
        linkedUrl.hostname.startsWith('images-live.') ||
        /\.(?:avif|bmp|gif|jpe?g|png|webp)$/i.test(linkedUrl.pathname)
      )
      const directSrc = [
        node.getAttribute('data-original'),
        node.getAttribute('data-full'),
        largestSrcsetImage(node.getAttribute('srcset')),
        node.getAttribute('data-src'),
        node.getAttribute('data-lazy-src'),
        node.getAttribute('src'),
      ].map(safeImageUrl).find((value): value is string => Boolean(value))
      const src = (linkLooksLikeImage ? linkedSrc : undefined) ?? directSrc
      if (src) blocks.push({ type: 'image', src, alt: node.getAttribute('alt') || 'Imagen de la publicación' })
      return
    }
    if (node.tagName === 'BR') {
      flush()
      return
    }
    const isBlock = /^(P|DIV|H[1-6]|LI|BLOCKQUOTE)$/.test(node.tagName)
    if (isBlock) flush()
    node.childNodes.forEach(walk)
    if (isBlock) flush()
  }
  document.body.childNodes.forEach(walk)
  flush()
  return { blocks, hashtags: [...hashtags.values()] }
}

const isDesktop = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window

async function post<T>(path: string, body: URLSearchParams, signal?: AbortSignal): Promise<T> {
  const response = await fetch(`https://live.warthunder.com${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
    signal,
  })
  if (!response.ok) throw new Error(`WT Live respondió con HTTP ${response.status}.`)
  return response.json() as Promise<T>
}

export async function fetchRecentCamouflages(signal?: AbortSignal, searchString = '', period = 0, page = 0, sort: WtLiveFeedSort = 'created'): Promise<WtLiveItem[]> {
  const result = isDesktop
    ? await invoke<FeedResponse>('fetch_recent_camouflages', { searchString, period, page, sort })
    : await post<FeedResponse>('/api/feed/get_regular/', new URLSearchParams({
    content: 'camouflage', sort, user: '', period: String(period),
    searchString, page: String(page), featured: 'false', subtype: 'all',
  }), signal)
  if (result.status !== 'OK' || !Array.isArray(result.data?.list)) {
    throw new Error('WT Live devolvió una respuesta que no reconoce el catálogo.')
  }
  return result.data.list.map(mapPost)
}

export async function fetchPostDetail(item: WtLiveItem, signal?: AbortSignal): Promise<WtLiveDetail> {
  const result = isDesktop
    ? await invoke<ApiPost>('fetch_post_detail', { langGroup: item.langGroup })
    : await post<ApiPost>('/api/posts/get/', new URLSearchParams({ lang_group: String(item.langGroup), language: '0' }), signal)
  const content = parseDescription(result.description)
  return {
    description: content.blocks,
    hashtags: content.hashtags,
    commentsUrl: `https://live.warthunder.com/post/${item.langGroup}/${item.language}/#comments`,
  }
}



