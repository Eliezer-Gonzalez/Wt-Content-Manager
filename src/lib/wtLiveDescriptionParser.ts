import type { WtLiveBlock } from './wtLive'
import {
  getFullResolutionImageUrl,
  imageRatio,
  largestSrcsetImage,
  positiveDimension,
  safeImageUrl,
  safeYouTubeVideoUrl,
} from './wtLiveParser'

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
        const value = cleanProse(label).replace(/\s+/g, ' ').trim()
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
