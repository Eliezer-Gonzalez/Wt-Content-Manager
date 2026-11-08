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

  const flush = () => {
    const raw = text.replace(/\s+/g, ' ').trim()
    text = ''
    if (!raw) return
    for (const match of raw.matchAll(/#[\p{L}\p{N}_-]+/gu)) {
      const tag = match[0].slice(1)
      if (!hashtags.has(tag.toLowerCase())) hashtags.set(tag.toLowerCase(), tag)
    }
    const value = raw
      .replace(/#[\p{L}\p{N}_-]+/gu, ' ')
      .replace(/\s+([,.;:!?])/g, '$1')
      .replace(/\s+/g, ' ')
      .trim()
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
