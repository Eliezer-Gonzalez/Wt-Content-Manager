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
  downloadUrl?: string
  fileName?: string
  likes: number
  downloads: number
}

export type WtLiveDetail = {
  description: WtLiveBlock[]
  commentsUrl: string
}

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
  images?: Array<{ src?: string; orig?: string; mq?: string }>
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
  const title = description.split(/[.!?\n]/, 1)[0]?.trim() || fileName || `Publicación ${post.id}`
  return {
    id: post.id,
    langGroup: post.lang_group,
    language: post.language,
    title: title.length > 72 ? `${title.slice(0, 69)}…` : title,
    description,
    author: post.author?.nickname || 'Autor desconocido',
    createdAt: post.created,
    imageUrl: post.images?.[0]?.src,
    downloadUrl: post.file?.link,
    fileName,
    likes: post.likes ?? 0,
    downloads: post.downloads ?? 0,
  }
}

function safeImageUrl(value: string | null | undefined): string | undefined {
  if (!value) return undefined
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && (url.hostname === 'warthunder.com' || url.hostname.endsWith('.warthunder.com')) ? url.href : undefined
  } catch {
    return undefined
  }
}

function parseDescription(markup = ''): WtLiveBlock[] {
  const document = new DOMParser().parseFromString(markup, 'text/html')
  const blocks: WtLiveBlock[] = []
  let text = ''
  const flush = () => {
    const value = text.replace(/\s+/g, ' ').trim()
    if (value) blocks.push({ type: 'text', text: value })
    text = ''
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
      const src = safeImageUrl(link) ?? safeImageUrl(node.getAttribute('src') ?? undefined)
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
  return blocks
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

export async function fetchRecentCamouflages(signal?: AbortSignal, searchString = ''): Promise<WtLiveItem[]> {
  const result = isDesktop
    ? await invoke<FeedResponse>('fetch_recent_camouflages', { searchString })
    : await post<FeedResponse>('/api/feed/get_regular/', new URLSearchParams({
    content: 'camouflage', sort: 'date', user: '', period: '',
    searchString, page: '0', featured: 'false', subtype: 'all',
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
  return {
    description: parseDescription(result.description),
    commentsUrl: `https://live.warthunder.com/post/${item.langGroup}/${item.language}/#comments`,
  }
}



