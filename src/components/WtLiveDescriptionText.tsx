import { useEffect, useRef, useState, type ReactNode } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { ExternalLink, Play, Video } from 'lucide-react'
import { Button } from './ui/Button'
import { useFocusTrap } from '../hooks/useFocusTrap'
import { useI18n } from '../i18n/I18nContext'
import { getSafeExternalHttpsUrl, getWtLivePostReference, type WtLiveBlock, type WtLiveItem, type WtLivePostReference } from '../lib/wtLive'
import type { ImageQualityMode } from '../lib/imageQuality'
import { isTauriRuntime } from '../lib/gameInstall'
import { WtLiveLinkedPostDialog } from './WtLiveLinkedPostDialog'

type LinkPart = { text: string; url: string }

function splitVisibleUrls(text: string): Array<string | LinkPart> {
  const parts: Array<string | LinkPart> = []
  const matcher = /https?:\/\/[^\s<>"']+/gi
  let lastIndex = 0
  for (const match of text.matchAll(matcher)) {
    const full = match[0]
    const start = match.index ?? 0
    const url = full.replace(/[.,!?;:]+$/, '')
    if (!url) continue
    if (start > lastIndex) parts.push(text.slice(lastIndex, start))
    parts.push(getSafeExternalHttpsUrl(url) ? { text: url, url } : url)
    const end = start + url.length
    if (end < start + full.length) parts.push(full.slice(url.length))
    lastIndex = start + full.length
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex))
  return parts.length ? parts : [text]
}

type Props = {
  block: Extract<WtLiveBlock, { type: 'text' | 'video' }>
  onOverlayChange?: (open: boolean) => void
  cancelDialogOpen?: boolean
  imageQuality?: ImageQualityMode
  renderLinkedPostActions?: (item: WtLiveItem) => ReactNode
  originPost?: WtLivePostReference
  onOpenWtLivePost?: (reference: WtLivePostReference) => void
}

export function WtLiveDescriptionText({
  block, onOverlayChange, cancelDialogOpen = false, imageQuality = 'optimized', renderLinkedPostActions, originPost, onOpenWtLivePost,
}: Props) {
  const { t } = useI18n()
  const [externalTarget, setExternalTarget] = useState<{ url: string; host: string } | null>(null)
  const [externalError, setExternalError] = useState(false)
  const [linkedPost, setLinkedPost] = useState<{ langGroup: number; language: string } | null>(null)
  const sourceLinkRef = useRef<HTMLElement | null>(null)
  const overlayWasOpenRef = useRef(false)
  const confirmRef = useRef<HTMLElement>(null)
  const cancelRef = useRef<HTMLButtonElement>(null)
  useFocusTrap({
    containerRef: confirmRef,
    initialFocusRef: cancelRef,
    onClose: () => setExternalTarget(null),
    enabled: Boolean(externalTarget),
  })
  useEffect(() => {
    const open = Boolean(externalTarget || linkedPost)
    if (open) onOverlayChange?.(true)
    return () => { if (open) onOverlayChange?.(false) }
  }, [externalTarget, linkedPost, onOverlayChange])

  useEffect(() => {
    const open = Boolean(externalTarget || linkedPost)
    if (open) {
      overlayWasOpenRef.current = true
      return
    }
    if (!overlayWasOpenRef.current) return
    overlayWasOpenRef.current = false
    const frame = window.requestAnimationFrame(() => sourceLinkRef.current?.focus())
    return () => window.cancelAnimationFrame(frame)
  }, [externalTarget, linkedPost])

  function handleLink(url: string, source: HTMLElement) {
    sourceLinkRef.current = source
    const safeUrl = getSafeExternalHttpsUrl(url)
    if (!safeUrl) return
    const internalPost = getWtLivePostReference(safeUrl)
    if (internalPost) {
      if (onOpenWtLivePost) {
        onOpenWtLivePost(internalPost)
        return
      }
      if (originPost?.langGroup === internalPost.langGroup && originPost.language === internalPost.language) return
      setLinkedPost(internalPost)
      return
    }
    setExternalError(false)
    setExternalTarget({ url: safeUrl, host: new URL(safeUrl).hostname })
  }

  async function openExternalTarget() {
    if (!externalTarget) return
    try {
      if (isTauriRuntime) {
        await invoke('open_external_https_url', { url: externalTarget.url })
      } else {
        window.open(externalTarget.url, '_blank', 'noopener,noreferrer')
      }
      setExternalTarget(null)
      setExternalError(false)
    } catch {
      setExternalError(true)
    }
  }

  const content = block.type === 'text' && block.segments?.length
    ? block.segments.flatMap(segment => {
        const url = segment.url ? getSafeExternalHttpsUrl(segment.url) : null
        return url ? [{ text: segment.text, url }] : splitVisibleUrls(segment.text)
      })
    : block.type === 'text' ? splitVisibleUrls(block.text) : []

  return (
    <>
      {block.type === 'video' ? (
        <article className="mx-auto my-2 w-full max-w-xl border border-[#46503f] bg-[#171c17] shadow-lg shadow-black/20">
          <div className="border-b border-[#46503f] bg-[linear-gradient(125deg,#242d24,#151a16_60%,#343b2e)] px-5 py-7 text-center sm:py-9">
            <Video size={34} className="mx-auto text-[#c8d1b6]" aria-hidden="true" />
            <p className="mb-0 mt-3 text-[10px] font-semibold tracking-[.18em] text-[#aeb990]">{t('youtubeVideo')}</p>
            <h3 className="mb-0 mt-1 font-display text-xl font-semibold leading-tight text-[#e6e7dd]">
              {block.title || t('youtubeVideoTitle')}
            </h3>
            <p className="mb-0 mt-1 break-all text-xs text-[#a5ad9a]">{new URL(block.url).hostname}</p>
          </div>
          <button
            type="button"
            onClick={event => handleLink(block.url, event.currentTarget)}
            className="group flex min-h-12 w-full items-center justify-center gap-2 bg-[#283026] px-4 py-3 text-sm font-semibold text-[#d2dcc1] transition-colors hover:bg-[#343d2e] hover:text-white focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-olive"
          >
            <Play size={15} fill="currentColor" aria-hidden="true" />
            {t('openYoutubeVideo')}
            <ExternalLink size={14} aria-hidden="true" />
          </button>
        </article>
      ) : (
        <p className="mb-0 whitespace-pre-line">
          {content.map((part, index) => typeof part === 'string' ? part : (
            <a
              key={`${part.url}-${index}`}
              href={part.url}
              onClick={event => { event.preventDefault(); handleLink(part.url, event.currentTarget) }}
              className="break-all text-[#d0dda9] underline decoration-[#78885d] underline-offset-2 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-olive"
            >
              {part.text}
            </a>
          ))}
        </p>
      )}

      {externalTarget && (
        <div className="fixed inset-0 z-[70] grid place-items-center bg-black/80 p-4" onClick={() => setExternalTarget(null)}>
          <section
            ref={confirmRef}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="external-link-title"
            aria-describedby="external-link-description"
            className="w-full max-w-md border border-[#46503f] bg-wt-panel p-6 shadow-2xl"
            onClick={event => event.stopPropagation()}
          >
            <h2 id="external-link-title" className="font-display text-2xl font-semibold text-[#e6e7dd]">
              {t('externalLinkTitle')}
            </h2>
            <p id="external-link-description" className="mt-3 text-sm leading-6 text-[#c0c5bb]">
              {t('externalLinkMessage', { host: externalTarget.host })}
            </p>
            <p className="mt-2 break-all border border-[#343b32] bg-[#171c17] p-2 text-xs text-[#aeb990]">{externalTarget.url}</p>
            {externalError && <p className="mt-3 text-xs text-amber-200" role="alert">{t('openLinkFailed')}</p>}
            <div className="mt-5 flex justify-end gap-2">
              <Button ref={cancelRef} variant="quiet" onClick={() => setExternalTarget(null)}>{t('skinCancel')}</Button>
              <Button variant="primary" onClick={() => void openExternalTarget()}>
                <ExternalLink size={14} aria-hidden="true" />{t('openExternalLink')}
              </Button>
            </div>
          </section>
        </div>
      )}

      {linkedPost && (
        <WtLiveLinkedPostDialog
          langGroup={linkedPost.langGroup}
          language={linkedPost.language}
          imageQuality={imageQuality}
          renderActions={renderLinkedPostActions}
          cancelDialogOpen={cancelDialogOpen}
          originPost={originPost}
          onClose={() => setLinkedPost(null)}
        />
      )}
    </>
  )
}
