import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Download, ExternalLink, X } from 'lucide-react'
import { Button } from './ui/Button'
import { ImageLightbox } from './ImageLightbox'
import { PostDetailSkeleton } from './PostDetailSkeleton'
import { PostGallery } from './PostGallery'
import { useFocusTrap } from '../hooks/useFocusTrap'
import { getFullResolutionImageUrl, getSafeCommentUrl, type WtLiveDetail, type WtLiveItem } from '../lib/wtLive'
import { imageSourceForQuality, type ImageQualityMode } from '../lib/imageQuality'
import type { SoundDownloadProgress } from '../lib/sounds'
import { useI18n } from '../i18n/I18nContext'
import { openUrl } from '@tauri-apps/plugin-opener'
import { isTauriRuntime } from '../lib/gameInstall'
import { WtLiveDescriptionText } from './WtLiveDescriptionText'
import { SoundPackageDownloadActions } from './SoundPackageDownloadActions'
import { HashtagList } from './HashtagList'
import { SoundReinstallAction } from './SoundReinstallAction'
import type { SoundLibraryController } from '../hooks/useSoundLibrary'
import type { SoundPackage } from '../lib/sounds'

type Props = {
  item: WtLiveItem
  detail: WtLiveDetail | null
  loading: boolean
  error: string
  imageQuality: ImageQualityMode
  canDownload: boolean
  downloadedLangGroups: ReadonlySet<number>
  downloadBusy: boolean
  downloadingId: number | null
  progress: SoundDownloadProgress | null
  downloadError: string
  activePackage: SoundPackage | null
  soundLibrary: SoundLibraryController
  canInstallPackage: boolean
  cancelDialogOpen?: boolean
  blockingDialogOpen?: boolean
  onDownload: (item: WtLiveItem) => void
  onTogglePause: () => void
  onCancel: () => void
  onSearchHashtag: (tag: string) => void
  onClose: () => void
}

export function SoundPostDetailDialog({
  item, detail, loading, error, imageQuality, canDownload, downloadedLangGroups, downloadBusy,
  downloadingId, progress, downloadError, activePackage, soundLibrary, canInstallPackage, cancelDialogOpen = false, blockingDialogOpen = false, onDownload, onTogglePause, onCancel,
  onSearchHashtag, onClose,
}: Props) {
  const { t } = useI18n()
  const dialogRef = useRef<HTMLElement>(null)
  const downloadActionsRef = useRef<HTMLDivElement>(null)
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const [zoomedImage, setZoomedImage] = useState<{ src: string; alt: string } | null>(null)
  const [descriptionOverlayOpen, setDescriptionOverlayOpen] = useState(false)
  const [reinstallDialogOpen, setReinstallDialogOpen] = useState(false)
  const handleDescriptionOverlay = useCallback((open: boolean) => setDescriptionOverlayOpen(open), [])
  const [linkError, setLinkError] = useState(false)
  const previewImages = useMemo(() => detail?.images.length
    ? detail.images
    : item.imageUrl
      ? [{ src: item.imageUrl, fullResolutionSrc: getFullResolutionImageUrl(item.imageUrl), aspectRatio: item.imageAspectRatio }]
      : [], [detail?.images, item.imageUrl, item.imageAspectRatio])

  useFocusTrap({ containerRef: dialogRef, initialFocusRef: closeButtonRef, onClose, enabled: !descriptionOverlayOpen && !reinstallDialogOpen && !cancelDialogOpen && !blockingDialogOpen })

  useEffect(() => {
    if (blockingDialogOpen) setZoomedImage(null)
  }, [blockingDialogOpen])

  useEffect(() => {
    if (downloadingId !== item.id) return
    const frame = window.requestAnimationFrame(() => downloadActionsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }))
    return () => window.cancelAnimationFrame(frame)
  }, [downloadingId, item.id, loading])

  async function openOriginalPost() {
    const url = getSafeCommentUrl(`https://live.warthunder.com/post/${item.langGroup}/${item.language}/`)
    if (!url) return
    try {
      if (isTauriRuntime) await openUrl(url)
      else window.open(url, '_blank', 'noopener,noreferrer')
      setLinkError(false)
    } catch {
      setLinkError(true)
    }
  }

  const renderLinkedPostActions = (linkedItem: WtLiveItem): ReactNode => (
    <SoundPackageDownloadActions
      item={linkedItem}
      canDownload={canDownload}
      downloaded={downloadedLangGroups.has(linkedItem.langGroup)}
      downloadBusy={downloadBusy}
      downloading={downloadingId === linkedItem.id}
      progress={downloadingId === linkedItem.id ? progress : null}
      downloadError={downloadError}
      onDownload={onDownload}
      onTogglePause={onTogglePause}
      onCancel={onCancel}
    />
  )

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/80 p-4" onClick={onClose}>
      <section
        ref={dialogRef}
        className="relative max-h-[90dvh] w-full max-w-[620px] overflow-y-auto [scrollbar-gutter:stable] border border-[#46503f] bg-wt-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="sound-post-title"
        onClick={event => event.stopPropagation()}
      >
        <Button
          ref={closeButtonRef}
          variant="icon"
          className="sticky right-2 top-2 z-10 float-right -mb-9 mr-2 border border-[#454d42] bg-[#151a16]"
          onClick={onClose}
          aria-label={t('close')}
        >
          <X size={18} />
        </Button>
        <div className="px-7 pb-7 pt-8 max-[420px]:px-5">
          <p className="flex items-center gap-2 text-[10px] tracking-[.14em] text-[#a0aa8a]">
            <Download size={13} />{t('soundMod')}
          </p>
          <h2 id="sound-post-title" className="mt-4 font-display text-4xl font-semibold leading-tight text-[#e6e7dd] max-[420px]:text-3xl">
            {item.title || t('postFallbackTitle', { id: item.id })}
          </h2>
          <p className="mb-5 mt-1.5 text-xs text-[#bdc99e]">{t('postMeta', { file: item.fileName ?? t('soundMod'), author: item.author || t('unknownAuthor') })}</p>

          {loading ? <PostDetailSkeleton label={t('detailLoading')} /> : error ? (
            <p className="my-6 text-sm leading-relaxed text-amber-200" role="alert">{error}</p>
          ) : (
            <>
              <PostGallery images={previewImages} quality={imageQuality} title={item.title} onZoom={setZoomedImage} />
              <section className="space-y-4 text-sm leading-7 text-[#c0c5bb]" aria-label={t('description')}>
                {detail?.description.length ? detail.description.map((block, index) => block.type === 'image' ? (
                  <button
                    type="button"
                    className="my-3 block w-full cursor-zoom-in"
                    key={`${block.src}-${index}`}
                    onClick={() => setZoomedImage({ src: block.fullResolutionSrc || getFullResolutionImageUrl(block.src), alt: block.alt || t('postImageAlt') })}
                    aria-label={`${t('enlargeImage')}: ${block.alt || t('postImageAlt')}`}
                  >
                    <img
                      src={imageSourceForQuality(block.src, block.fullResolutionSrc, imageQuality)}
                      alt={block.alt || t('postImageAlt')}
                      className="h-auto max-h-[65vh] w-full object-contain"
                      loading="lazy"
                    />
                  </button>
                ) : (
                  <WtLiveDescriptionText
                    block={block}
                    imageQuality={imageQuality}
                    onOverlayChange={handleDescriptionOverlay}
                    cancelDialogOpen={cancelDialogOpen}
                    blockingDialogOpen={blockingDialogOpen}
                    renderLinkedPostActions={renderLinkedPostActions}
                    originPost={item}
                    key={index}
                  />
                )) : <WtLiveDescriptionText
                  block={{ type: 'text', text: item.description || t('noDescription') }}
                  imageQuality={imageQuality}
                  onOverlayChange={handleDescriptionOverlay}
                  cancelDialogOpen={cancelDialogOpen}
                  blockingDialogOpen={blockingDialogOpen}
                  renderLinkedPostActions={renderLinkedPostActions}
                  originPost={item}
                />}
              </section>
              <HashtagList hashtags={detail?.hashtags ?? []} id="sound-post-hashtags-heading" onSelect={onSearchHashtag} />
            </>
          )}

          <p className="mb-4 mt-5 border-t border-[#343b32] pt-3 text-xs text-[#a5ad9a]">
            {t('likes', { count: detail?.stats?.likes ?? item.likes })} · {t('downloadsCount', { count: detail?.stats?.downloads ?? item.downloads })}
          </p>
          <div ref={downloadActionsRef}>
            <SoundPackageDownloadActions
              item={item}
              canDownload={canDownload}
              downloaded={downloadedLangGroups.has(item.langGroup)}
              downloadBusy={downloadBusy}
              downloading={downloadingId === item.id}
              progress={downloadingId === item.id ? progress : null}
              downloadError={downloadError}
              onDownload={onDownload}
              onTogglePause={onTogglePause}
              onCancel={onCancel}
            />
            {activePackage && (
              <SoundReinstallAction
                packageInfo={activePackage}
                library={soundLibrary}
                canInstall={canInstallPackage}
                blockingDialogOpen={blockingDialogOpen}
                onConfirmingChange={setReinstallDialogOpen}
              />
            )}
          </div>
          <button type="button" className="mt-4 inline-flex items-center gap-1.5 text-sm text-[#bdc99e] hover:text-[#dce5c4]" onClick={() => void openOriginalPost()}>
            {t('openOriginalPost')} <ExternalLink size={13} />
          </button>
          {linkError && <p className="mt-2 text-xs text-amber-200" role="alert">{t('openLinkFailed')}</p>}
        </div>
      </section>
      {zoomedImage && !blockingDialogOpen && <ImageLightbox src={zoomedImage.src} alt={zoomedImage.alt} onClose={() => setZoomedImage(null)} />}
    </div>
  )
}
