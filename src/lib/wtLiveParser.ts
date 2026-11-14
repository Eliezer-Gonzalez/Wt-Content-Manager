import type { WtLiveImage, WtLiveItem } from './wtLive'

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
  file?: { name?: string; link?: string; size?: number }
}

export function extractImageSource(source: ApiImageSource | null | undefined): string | undefined {
  if (!source) return undefined
  if (typeof source === 'string') return source
  return typeof source.src === 'string' ? source.src : undefined
}

export function positiveDimension(value: unknown): number | undefined {
  const dimension = Number(value)
  return Number.isFinite(dimension) && dimension > 0 ? Math.round(dimension) : undefined
}

export function positiveFileSize(value: unknown): number | undefined {
  if (typeof value !== 'number' && typeof value !== 'string') return undefined
  if (typeof value === 'string' && value.trim() === '') return undefined
  const bytes = Number(value)
  return Number.isSafeInteger(bytes) && bytes >= 0 ? bytes : undefined
}

export function imageRatio(width?: number, height?: number, reported?: unknown): number | undefined {
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
    fileSizeBytes: positiveFileSize(post.file?.size),
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

export function safeYouTubeVideoUrl(value: string | null | undefined): string | undefined {
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
