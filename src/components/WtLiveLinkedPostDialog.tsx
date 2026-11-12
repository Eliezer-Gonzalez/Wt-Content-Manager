import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { ArrowLeft, Shield, X } from 'lucide-react'
import { Button } from './ui/Button'
import { ImageLightbox } from './ImageLightbox'
import { PostDetailSkeleton } from './PostDetailSkeleton'
import { PostGallery } from './PostGallery'
import { useFocusTrap } from '../hooks/useFocusTrap'
import { useI18n } from '../i18n/I18nContext'
import { fetchLinkedPost, getFullResolutionImageUrl, type WtLiveDetail, type WtLiveItem, type WtLivePostReference } from '../lib/wtLive'
import type { ImageQualityMode } from '../lib/imageQuality'
import { WtLiveDescriptionText } from './WtLiveDescriptionText'

type Props = {
  langGroup: number
  language: string
  imageQuality: ImageQualityMode
  renderActions?: (item: WtLiveItem) => ReactNode
  cancelDialogOpen?: boolean
  originPost?: WtLivePostReference
  onClose: () => void
}

export function WtLiveLinkedPostDialog({ langGroup, language, imageQuality, renderActions, cancelDialogOpen = false, originPost, onClose }: Props) {
  const { t } = useI18n()
  const dialogRef = useRef<HTMLElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const [history, setHistory] = useState<WtLivePostReference[]>([{ langGroup, language }])
  const currentPost = history[history.length - 1]
  const [post, setPost] = useState<{ item: WtLiveItem; detail: WtLiveDetail } | null>(null)
  const [error, setError] = useState(false)
  const [descriptionOverlayOpen, setDescriptionOverlayOpen] = useState(false)
  const [zoomedImage, setZoomedImage] = useState<{ src: string; alt: string } | null>(null)
  const handleDescriptionOverlay = useCallback((open: boolean) => setDescriptionOverlayOpen(open), [])

  const navigateToPost = useCallback((reference: WtLivePostReference) => {
    if (originPost?.langGroup === reference.langGroup && originPost.language === reference.language) {
      onClose()
      return
    }
    setHistory(previous => {
      const existingIndex = previous.findIndex(entry => entry.langGroup === reference.langGroup && entry.language === reference.language)
      return existingIndex >= 0 ? previous.slice(0, existingIndex + 1) : [...previous, reference]
    })
  }, [onClose, originPost])

  const goBack = useCallback(() => {
    if (history.length <= 1) {
      onClose()
      return
    }
    const previous = history[history.length - 2]
    if (originPost?.langGroup === previous.langGroup && originPost.language === previous.language) {
      onClose()
      return
    }
    setHistory(entries => entries.slice(0, -1))
  }, [history, onClose, originPost])

  useEffect(() => {
    const controller = new AbortController()
    let active = true
    setPost(null)
    setError(false)
    void fetchLinkedPost(currentPost.langGroup, currentPost.language, controller.signal)
      .then(result => { if (active) setPost(result) })
      .catch(() => { if (active && !controller.signal.aborted) setError(true) })
    return () => {
      active = false
      controller.abort()
    }
  }, [currentPost.langGroup, currentPost.language])

  useFocusTrap({ containerRef: dialogRef, initialFocusRef: closeRef, onClose: () => {
    if (!zoomedImage) onClose()
  }, enabled: !zoomedImage && !descriptionOverlayOpen && !cancelDialogOpen })

  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-black/85 p-4" onClick={onClose}>
      <section
        ref={dialogRef}
        className="relative max-h-[88dvh] w-full max-w-[620px] overflow-y-auto border border-[#46503f] bg-wt-panel p-7 shadow-2xl max-[420px]:p-5"
        role="dialog"
        aria-modal="true"
        aria-labelledby="linked-post-title"
        onClick={event => event.stopPropagation()}
      >
        {history.length > 1 && (
          <Button variant="quiet" className="mb-3 min-h-8 px-2.5 py-1 text-xs" onClick={goBack}>
            <ArrowLeft size={14} aria-hidden="true" />{t('backToPreviousPost')}
          </Button>
        )}
        <Button
          ref={closeRef}
          variant="icon"
          className="sticky right-0 top-0 z-10 float-right -mb-9 -mr-2 border border-[#454d42] bg-[#151a16]"
          onClick={onClose}
          aria-label={t('close')}
        >
          <X size={18} />
        </Button>
        <p className="flex items-center gap-2 text-[10px] tracking-[.14em] text-[#a0aa8a]">
          <Shield size={13} />{t('detailSource')}
        </p>
        <h2 id="linked-post-title" className="mt-4 font-display text-3xl font-semibold leading-tight text-[#e6e7dd]">
          {post?.item.title || t('postFallbackTitle', { id: currentPost.langGroup })}
        </h2>
        {post && <p className="mb-5 mt-1.5 text-xs text-[#bdc99e]">{t('postMeta', { file: post.item.fileName || t('wtLivePost'), author: post.item.author || t('unknownAuthor') })}</p>}

        {!post && !error ? <PostDetailSkeleton label={t('detailLoading')} /> : error ? (
          <p className="my-6 text-sm leading-relaxed text-amber-200" role="alert">{t('wtLivePostLoadFailed')}</p>
        ) : post ? (
          <section className="space-y-4 text-sm leading-7 text-[#c0c5bb]" aria-label={t('description')}>
            <PostGallery
              images={post.detail.images}
              quality={imageQuality}
              title={post.item.title || t('postFallbackTitle', { id: currentPost.langGroup })}
              onZoom={setZoomedImage}
            />
            {post.detail.description.length ? post.detail.description.map((block, index) => block.type === 'image' ? (
              <button
                type="button"
                className="my-3 block w-full cursor-zoom-in"
                key={`${block.src}-${index}`}
                onClick={() => setZoomedImage({ src: block.fullResolutionSrc || getFullResolutionImageUrl(block.src), alt: block.alt || t('postImageAlt') })}
                aria-label={`${t('enlargeImage')}: ${block.alt || t('postImageAlt')}`}
              >
                <img src={block.src} alt={block.alt || t('postImageAlt')} className="h-auto max-h-[65vh] w-full object-contain" loading="lazy" />
              </button>
            ) : (
              <WtLiveDescriptionText
                block={block}
                imageQuality={imageQuality}
                cancelDialogOpen={cancelDialogOpen}
                onOverlayChange={handleDescriptionOverlay}
                renderLinkedPostActions={renderActions}
                originPost={originPost}
                onOpenWtLivePost={navigateToPost}
                key={`description-${index}`}
              />
            )) : <p className="mb-0">{post.item.description || t('noDescription')}</p>}
            {renderActions && (
              <>
                <p className="mb-4 mt-5 border-t border-[#343b32] pt-3 text-xs text-[#a5ad9a]">
                  {t('likes', { count: post.item.likes })} · {t('downloadsCount', { count: post.item.downloads })}
                </p>
                {renderActions(post.item)}
              </>
            )}
          </section>
        ) : null}
      </section>
      {zoomedImage && <ImageLightbox src={zoomedImage.src} alt={zoomedImage.alt} onClose={() => setZoomedImage(null)} />}
    </div>
  )
}
