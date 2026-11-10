import { useCallback, useMemo, useRef, useState } from 'react'
import { ExternalLink, Shield, X } from 'lucide-react'
import { Button } from './ui/Button'
import { PostInstallActions } from './PostInstallActions'
import { PostDetailSkeleton } from './PostDetailSkeleton'
import { ImageLightbox } from './ImageLightbox'
import { PostGallery } from './PostGallery'
import { PostImage } from './PostImage'
import { useFocusTrap } from '../hooks/useFocusTrap'
import { getFullResolutionImageUrl, getSafeCommentUrl } from '../lib/wtLive'
import { isTauriRuntime } from '../lib/gameInstall'
import { openUrl } from '@tauri-apps/plugin-opener'
import { useI18n } from '../i18n/I18nProvider'
import type { WtLiveDetail, WtLiveImage, WtLiveItem } from '../lib/wtLive'
import type { SkinInstaller } from '../hooks/useSkinInstaller'
import type { InstalledSkin } from '../lib/localLibrary'
import type { ImageQualityMode } from '../lib/imageQuality'
import { imageSourceForQuality } from '../lib/imageQuality'
import { WtLiveDescriptionText } from './WtLiveDescriptionText'

type Props = {
  item: WtLiveItem
  imageQuality: ImageQualityMode
  detail: WtLiveDetail | null
  loading: boolean
  error: string
  canInstall: boolean
  installer: SkinInstaller
  installedEntry?: InstalledSkin | null
  onInstall: () => void
  onReinstall: (entry: InstalledSkin) => void
  onUninstall?: (entry: InstalledSkin) => void
  onChooseGame: () => void
  onClose: () => void
  onSearchHashtag: (hashtag: string) => void
}

export function PostDetailDialog({
  item, imageQuality, detail, loading, error, canInstall, installer,
  installedEntry, onInstall, onReinstall, onUninstall, onChooseGame, onClose, onSearchHashtag,
}: Props) {
  const { t } = useI18n()
  const [zoomedImage, setZoomedImage] = useState<{ src: string; alt: string } | null>(null)
  const [descriptionOverlayOpen, setDescriptionOverlayOpen] = useState(false)
  const [commentError, setCommentError] = useState(false)
  const dialogRef = useRef<HTMLElement>(null)
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const handleDescriptionOverlay = useCallback((open: boolean) => setDescriptionOverlayOpen(open), [])
  const { installing } = installer
  const hasDescription = detail?.description.some(block => block.type !== 'image') ?? false
  const previewImage = useMemo(() => item.imageUrl
    ? {
        src: item.imageUrl,
        fullResolutionSrc: getFullResolutionImageUrl(item.imageUrl),
        aspectRatio: item.imageAspectRatio,
      }
    : null, [item.imageUrl, item.imageAspectRatio])
  const cleanFallbackDescription = item.description.replace(/#[\p{L}\p{N}_-]+/gu, ' ').replace(/\s+/g, ' ').trim()

  const galleryImages = useMemo(() => {
    const detailedImages = detail?.images ?? []
    const images: WtLiveImage[] = detailedImages.length
      ? previewImage
        ? [
            {
              ...detailedImages[0],
              src: previewImage.src,
              fullResolutionSrc: detailedImages[0].fullResolutionSrc || previewImage.fullResolutionSrc,
              aspectRatio: previewImage.aspectRatio || detailedImages[0].aspectRatio,
              width: detailedImages[0].width,
              height: detailedImages[0].height,
            },
            ...detailedImages.slice(1),
          ]
        : detailedImages
      : previewImage
        ? [previewImage]
        : []
    const seen = new Set<string>()
    return images.filter(image => {
      const key = image.fullResolutionSrc || image.src
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
  }, [detail?.images, previewImage])

  useFocusTrap({
    containerRef: dialogRef,
    initialFocusRef: closeButtonRef,
    onClose,
    enabled: !zoomedImage && !descriptionOverlayOpen,
    canEscape: !installing,
  })

  async function handleOpenComments() {
    if (!detail?.commentsUrl) return
    setCommentError(false)
    const safeUrl = getSafeCommentUrl(detail.commentsUrl)
    if (!safeUrl) {
      setCommentError(true)
      return
    }
    try {
      if (isTauriRuntime) await openUrl(safeUrl)
      else window.open(safeUrl, '_blank', 'noopener,noreferrer')
    } catch {
      setCommentError(true)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/80 p-4"
      onClick={() => {
        if (!installing) onClose()
      }}
    >
      <section
        ref={dialogRef}
        className="relative max-h-[90dvh] w-full max-w-[620px] overflow-y-auto [scrollbar-gutter:stable] border border-[#46503f] bg-wt-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="post-detail-title"
        onClick={event => event.stopPropagation()}
      >
        <Button
          ref={closeButtonRef}
          variant="icon"
          className="sticky right-2 top-2 z-10 float-right -mb-9 mr-2 border border-[#454d42] bg-[#151a16]"
          onClick={onClose}
          disabled={installing}
          aria-label={t('close')}
        >
          <X size={18} />
        </Button>

        <div className="px-7 pb-7 pt-8 max-[420px]:px-5">
          <p className="flex items-center gap-2 text-[10px] tracking-[.14em] text-[#a0aa8a]">
            <Shield size={13} />
            {t('detailSource')}
          </p>
          <h2
            id="post-detail-title"
            className="mt-4 font-display text-4xl font-semibold leading-tight text-[#e6e7dd] max-[420px]:text-3xl"
          >
            {item.title || t('postFallbackTitle', { id: item.id })}
          </h2>
          <p className="mb-5 mt-1.5 text-xs text-[#bdc99e]">
            {t('postMeta', { file: item.fileName ?? t('camouflage'), author: item.author || t('unknownAuthor') })}
          </p>

          {loading ? (
            <PostDetailSkeleton label={t('detailLoading')} />
          ) : error ? (
            <p className="my-6 text-sm leading-relaxed text-amber-200" role="alert">
              {error}
            </p>
          ) : (
            <>
              <section
                className="space-y-4 text-sm leading-7 text-[#c0c5bb]"
                aria-labelledby="post-description-heading"
              >
                {hasDescription && (
                  <h3
                    id="post-description-heading"
                    className="mb-0 border-l-2 border-[#87976a] pl-3 text-xs font-semibold uppercase tracking-[.12em] text-[#c8d1b6]"
                  >
                    {t('description')}
                  </h3>
                )}
                <PostGallery
                  images={galleryImages}
                  quality={imageQuality}
                  title={item.title || t('postFallbackTitle', { id: item.id })}
                  onZoom={setZoomedImage}
                />
                {detail?.description.length ? (
                  detail.description.map((block, index) =>
                    block.type === 'image' ? (
                      <button
                        type="button"
                        className="my-3 block w-full cursor-zoom-in"
                        key={`${block.src}-${index}`}
                        onClick={() => setZoomedImage({
                          src: block.fullResolutionSrc || getFullResolutionImageUrl(block.src),
                          alt: block.alt || t('postImageAlt'),
                        })}
                        aria-label={`${t('enlargeImage')}: ${block.alt || t('postImageAlt')}`}
                      >
                        <PostImage
                          className="h-auto max-h-[65vh] w-full object-contain"
                          image={{
                            ...block,
                            src: imageSourceForQuality(block.src, block.fullResolutionSrc, imageQuality),
                          }}
                          alt={block.alt || t('postImageAlt')}
                          loading="lazy"
                        />
                      </button>
                    ) : (
                      <WtLiveDescriptionText block={block} imageQuality={imageQuality} onOverlayChange={handleDescriptionOverlay} originPost={item} key={index} />
                    ),
                  )
                ) : (
                  <WtLiveDescriptionText
                    block={{ type: 'text', text: cleanFallbackDescription || t('noDescription') }}
                    imageQuality={imageQuality}
                    onOverlayChange={handleDescriptionOverlay}
                    originPost={item}
                  />
                )}
              </section>

              {!!detail?.hashtags.length && (
                <section
                  className="mt-6 border-t border-[#343b32] pt-4"
                  aria-labelledby="post-hashtags-heading"
                >
                  <h3
                    id="post-hashtags-heading"
                    className="mb-3 text-xs font-semibold uppercase tracking-[.12em] text-[#aeb990]"
                  >
                    {t('hashtags')}
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {detail.hashtags.map(tag => (
                      <button
                        key={tag}
                        type="button"
                        disabled={installing}
                        onClick={() => onSearchHashtag(tag)}
                        className="border border-[#46513e] bg-[#283026] px-2.5 py-1 text-xs text-[#d2dcc1] transition-colors hover:border-[#9eae7b] hover:bg-[#343d2e] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-olive disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        #{tag}
                      </button>
                    ))}
                  </div>
                </section>
              )}
            </>
          )}

          <p className="mt-5 border-t border-[#343b32] pt-3 text-xs text-[#a5ad9a]">
            {t('likes', { count: item.likes })} · {t('downloadsCount', { count: item.downloads })}
          </p>

          <PostInstallActions
            downloadUrl={item.downloadUrl}
            canInstall={canInstall}
            installer={installer}
            installedEntry={installedEntry}
            onInstall={onInstall}
            onReinstall={onReinstall}
            onUninstall={onUninstall}
            onChooseGame={onChooseGame}
          />

          {detail?.commentsUrl && (
            <button
              type="button"
              className="mt-4 inline-flex items-center gap-1.5 text-sm text-[#bdc99e] hover:text-[#dce5c4]"
              onClick={() => void handleOpenComments()}
            >
              {t('readComments')} <ExternalLink size={13} />
            </button>
          )}
          {detail?.commentsUrl && (
            <div className="mt-2 min-h-5">
              {commentError && <p className="mb-0 text-xs leading-5 text-amber-200" role="alert">{t('openLinkFailed')}</p>}
            </div>
          )}
        </div>
      </section>

      {zoomedImage && (
        <ImageLightbox
          src={zoomedImage.src}
          alt={zoomedImage.alt}
          onClose={() => setZoomedImage(null)}
        />
      )}
    </div>
  )
}
