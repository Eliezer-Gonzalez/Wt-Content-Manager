import type { WtLiveBlock, WtLiveImage, WtLiveItem } from './wtLive'

type ApiImageSource = string | { src?: string }

export type ApiPost = {
  id: number
  lang_group: number
  language: string
  type: string
  created: number
  author?: { nickname?: string }
  likes?: number
  downloads?: number
  description?: string
  images?: Array<{
    src?: ApiImageSource
    orig?: ApiImageSource
    mq?: ApiImageSource
    width?: number
    height?: number
    ratio?: number | string
  }>
  file?: { name?: string; link?: string }
}

export function extractImageSource(source: ApiImageSource | null | undefined): string | undefined {
  if (!source) return undefined
  if (typeof source === 'string') return source
  return typeof source.src === 'string' ? source.src : undefined
}

function positiveDimension(value: unknown): number | undefined {
  const dimension = Number(value)
  return Number.isFinite(dimension) && dimension > 0 ? Math.round(dimension) : undefined
}

function imageRatio(width?: number, height?: number, reported?: unknown): number | undefined {
  const ratio = width && height ? width / height : Number(reported)
  return Number.isFinite(ratio) && ratio > 0 ? ratio : undefined
}

export function mapPostImages(post: ApiPost): WtLiveImage[] {
  return (post.images ?? []).flatMap(image => {
    const original = safeImageUrl(
      extractImageSource(image.orig) || extractImageSource(image.src) || extractImageSource(image.mq),
    )
    const display = safeImageUrl(
      extractImageSource(image.src) || extractImageSource(image.mq) || extractImageSource(image.orig),
    )
    if (!display) return []

    const width = positiveDimension(image.width)
    const height = positiveDimension(image.height)
    return [{
      src: display,
      fullResolutionSrc: getFullResolutionImageUrl(original || display),
      thumbnailSrc: safeImageUrl(
        extractImageSource(image.mq) || extractImageSource(image.src) || extractImageSource(image.orig),
      ) || display,
      width,
      height,
      aspectRatio: imageRatio(width, height, image.ratio),
    }]
  })
}

export function plainText(markup = ''): string {
  const document = new DOMParser().parseFromString(markup, 'text/html')
  return (document.body.textContent ?? '').replace(/\s+/g, ' ').trim()
}

export function mapPost(post: ApiPost): WtLiveItem {
  const description = plainText(post.description)
  const fileName = post.file?.name
  const image = post.images?.[0]
  const reportedRatio = Number(image?.ratio)
  const imageAspectRatio =
    image?.width && image?.height
      ? image.width / image.height
      : reportedRatio > 0
        ? reportedRatio
        : undefined
  const readableDescription = description.replace(/#[\p{L}\p{N}_-]+/gu, ' ').replace(/\s+/g, ' ').trim()
  const title = readableDescription.split(/[.!?]+(?=\s|$)|\n/, 1)[0]?.trim() || fileName || ''
  const rawImageUrl =
    extractImageSource(image?.orig) ||
    extractImageSource(image?.src) ||
    extractImageSource(image?.mq)

  return {
    id: post.id,
    langGroup: post.lang_group,
    language: post.language,
    title: title.length > 72 ? `${title.slice(0, 69)}…` : title,
    description,
    author: post.author?.nickname || '',
    createdAt: post.created,
    imageUrl: safeImageUrl(rawImageUrl),
    imageAspectRatio:
      imageAspectRatio && Number.isFinite(imageAspectRatio) && imageAspectRatio > 0
        ? imageAspectRatio
        : undefined,
    downloadUrl: post.file?.link,
    fileName,
    likes: post.likes ?? 0,
    downloads: post.downloads ?? 0,
  }
}

export function getFullResolutionImageUrl(value: string): string {
  return safeImageUrl(value.replace('_lq/', '/')) ?? ''
}

export function safeImageUrl(value: string | null | undefined): string | undefined {
  if (!value) return undefined
  try {
    const url = new URL(value, 'https://live.warthunder.com')
    return url.protocol === 'https:' &&
      (url.hostname === 'warthunder.com' || url.hostname.endsWith('.warthunder.com'))
      ? url.href
      : undefined
  } catch {
    return undefined
  }
}

function safeYouTubeVideoUrl(value: string | null | undefined): string | undefined {
  if (!value) return undefined
  try {
    const url = new URL(value, 'https://live.warthunder.com')
    if (url.protocol !== 'https:' || url.username || url.password || url.port || !['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtu.be', 'www.youtu.be', 'youtube-nocookie.com', 'www.youtube-nocookie.com'].includes(url.hostname)) {
      return undefined
    }
    const isShortUrl = url.hostname.endsWith('youtu.be')
    const isEmbed = /\/(?:embed|shorts|live)\/([^/?#]+)/i.exec(url.pathname)
    const videoId = isShortUrl
      ? url.pathname.split('/').filter(Boolean)[0]
      : url.pathname === '/watch'
        ? url.searchParams.get('v')
        : isEmbed?.[1]
    if (!videoId || !/^[\w-]{6,20}$/.test(videoId)) return undefined
    const watchUrl = new URL('https://www.youtube.com/watch')
    watchUrl.searchParams.set('v', videoId)
    for (const parameter of ['list', 'index']) {
      const value = url.searchParams.get(parameter)
      if (value) watchUrl.searchParams.set(parameter, value)
    }
    const startTime = url.searchParams.get('t') || url.searchParams.get('start')
    if (startTime) watchUrl.searchParams.set('t', startTime)
    return watchUrl.href
  } catch {
    return undefined
  }
}

export function largestSrcsetImage(value: string | null): string | undefined {
  if (!value) return undefined
  const candidates = value.split(',').flatMap(candidate => {
    const [url, descriptor = '1x'] = candidate.trim().split(/\s+/, 2)
    const resolution = Number.parseFloat(descriptor)
    return url && Number.isFinite(resolution) ? [{ url, resolution }] : []
  })
  return candidates.sort((a, b) => b.resolution - a.resolution)[0]?.url
}

export function parseDescription(markup = ''): { blocks: WtLiveBlock[]; hashtags: string[] } {
  const document = new DOMParser().parseFromString(markup, 'text/html')
  const blocks: WtLiveBlock[] = []
  const hashtags = new Map<string, string>()
  let text = ''
  const inlineLinks: Array<{ text: string; url?: string }> = []
  const videoIds = new Set<string>()

  const addVideo = (value: string | null | undefined, title?: string) => {
    const url = safeYouTubeVideoUrl(value)
    if (!url) return false
    const parsed = new URL(url)
    const id = parsed.hostname.endsWith('youtu.be')
      ? parsed.pathname.split('/').filter(Boolean)[0]
      : parsed.pathname === '/watch'
        ? parsed.searchParams.get('v')
        : /\/(?:embed|shorts|live)\/([^/?#]+)/i.exec(parsed.pathname)?.[1]
    if (!id || videoIds.has(id)) return true
    videoIds.add(id)
    const cleanTitle = title?.trim()
    blocks.push({ type: 'video', url, ...(cleanTitle && !/^https?:\/\//i.test(cleanTitle) ? { title: cleanTitle } : {}) })
    return true
  }

  const cleanProse = (value: string) => value
    .split(/(https?:\/\/[^\s<>"']+)/gi)
    .map(part => /^https?:\/\//i.test(part) ? part : part.replace(/#[\p{L}\p{N}_-]+/gu, tag => {
      const name = tag.slice(1)
      if (!hashtags.has(name.toLowerCase())) hashtags.set(name.toLowerCase(), name)
      return ' '
    }))
    .join('')
    .replace(/\s+([,.;:!?])/g, '$1')

  const flush = () => {
    const raw = text.replace(/\s+/g, ' ').trim()
    text = ''
    if (!raw) return
    const segments: Array<{ text: string; url?: string }> = []
    const marker = /\uE000(\d+)\uE001/g
    let lastIndex = 0
    for (const match of raw.matchAll(marker)) {
      const start = match.index ?? 0
      const before = cleanProse(raw.slice(lastIndex, start))
      if (before) segments.push({ text: before })
      const link = inlineLinks[Number(match[1])]
      if (link) segments.push(link)
      lastIndex = start + match[0].length
    }
    const after = cleanProse(raw.slice(lastIndex))
    if (after) segments.push({ text: after })
    inlineLinks.length = 0
    const value = segments.map(segment => segment.text).join('').replace(/\s+/g, ' ').trim()
    if (value) blocks.push({ type: 'text', text: value, ...(segments.some(segment => segment.url) ? { segments } : {}) })
  }

  const walk = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const value = node.textContent ?? ''
      const matcher = /https?:\/\/[^\s<>"']+/gi
      let lastIndex = 0
      for (const match of value.matchAll(matcher)) {
        const start = match.index ?? 0
        const candidate = match[0].replace(/[),.;!?\]]+$/, '')
        if (!safeYouTubeVideoUrl(candidate)) continue
        text += value.slice(lastIndex, start)
        flush()
        addVideo(candidate)
        lastIndex = start + candidate.length
      }
      text += value.slice(lastIndex)
      return
    }
    if (!(node instanceof Element)) return
    if (node.tagName === 'A' && !node.querySelector('img')) {
      const label = (node.textContent ?? '').replace(/\s+/g, ' ').trim()
      const url = node.getAttribute('href')?.trim()
      if (safeYouTubeVideoUrl(url)) {
        flush()
        addVideo(url, label)
        return
      }
      if (label) {
        const value = cleanProse(label)
          .replace(/\s+/g, ' ')
          .trim()
        if (value) {
          const linkIndex = inlineLinks.push({ text: value, ...(url ? { url } : {}) }) - 1
          text += `\uE000${linkIndex}\uE001`
        }
      }
      return
    }
    if (node.tagName === 'IFRAME') {
      flush()
      addVideo(node.getAttribute('src'), node.getAttribute('title') || undefined)
      return
    }
    if (node.tagName === 'IMG') {
      flush()
      const link = node.closest('a')?.getAttribute('href')
      const linkedSrc = safeImageUrl(link)
      const linkedUrl = linkedSrc ? new URL(linkedSrc) : null
      const linkLooksLikeImage =
        linkedUrl &&
        (linkedUrl.hostname.startsWith('images-live.') ||
          /\.(?:avif|bmp|gif|jpe?g|png|webp)$/i.test(linkedUrl.pathname))
      const directSrc = [
        node.getAttribute('data-original'),
        node.getAttribute('data-full'),
        largestSrcsetImage(node.getAttribute('srcset')),
        node.getAttribute('data-src'),
        node.getAttribute('data-lazy-src'),
        node.getAttribute('src'),
      ]
        .map(safeImageUrl)
        .find((value): value is string => Boolean(value))
      const src = (linkLooksLikeImage ? linkedSrc : undefined) ?? directSrc
      if (src) {
        const width = positiveDimension(node.getAttribute('width') ?? node.getAttribute('data-width'))
        const height = positiveDimension(node.getAttribute('height') ?? node.getAttribute('data-height'))
        blocks.push({
          type: 'image',
          src,
          fullResolutionSrc: getFullResolutionImageUrl(src),
          alt: node.getAttribute('alt') || '',
          width,
          height,
          aspectRatio: imageRatio(width, height),
        })
      }
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
