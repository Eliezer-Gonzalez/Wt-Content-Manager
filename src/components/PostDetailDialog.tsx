import { useCallback, useEffect, useRef, useState } from 'react'
import { ExternalLink, Shield, X } from 'lucide-react'
import { Button } from './ui/Button'
import { PostInstallActions } from './PostInstallActions'
import { ImageLightbox } from './ImageLightbox'
import { PostDetailBody } from './PostDetailBody'
import { useFocusTrap } from '../hooks/useFocusTrap'
import { getSafeCommentUrl } from '../lib/wtLive'
import { isTauriRuntime } from '../lib/gameInstall'
import { openUrl } from '@tauri-apps/plugin-opener'
import { useI18n } from '../i18n/I18nProvider'
import type { WtLiveDetail, WtLiveItem } from '../lib/wtLive'
import type { SkinInstaller } from '../hooks/useSkinInstaller'
import type { InstalledSkin } from '../lib/localLibrary'
import type { ImageQualityMode } from '../lib/imageQuality'

type Props = {
  item: WtLiveItem
  imageQuality: ImageQualityMode
  detail: WtLiveDetail | null
  loading: boolean
  error: string
  canInstall: boolean
  installer: SkinInstaller
  cancelDialogOpen?: boolean
  installedEntry?: InstalledSkin | null
  onInstall: () => void
  onReinstall: (entry: InstalledSkin) => void
  onUninstall?: (entry: InstalledSkin) => void
  onChooseGame: () => void
  onClose: () => void
  onSearchHashtag: (hashtag: string) => void
}

export function PostDetailDialog({
  item, imageQuality, detail, loading, error, canInstall, installer, cancelDialogOpen = false,
  installedEntry, onInstall, onReinstall, onUninstall, onChooseGame, onClose, onSearchHashtag,
}: Props) {
  const { t } = useI18n()
  const [zoomedImage, setZoomedImage] = useState<{ src: string; alt: string } | null>(null)
  const [descriptionOverlayOpen, setDescriptionOverlayOpen] = useState(false)
  const [commentError, setCommentError] = useState(false)
  const dialogRef = useRef<HTMLElement>(null)
  const installActionsRef = useRef<HTMLDivElement>(null)
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const handleDescriptionOverlay = useCallback((open: boolean) => setDescriptionOverlayOpen(open), [])
  const activeInstallMatches = installer.installing && installer.activeLangGroup === item.langGroup
  const resultMatches = installer.resultLangGroup === item.langGroup
  const itemInstaller = activeInstallMatches || resultMatches
    ? installer
    : {
        ...installer,
        installing: false,
        progress: null,
        paused: false,
        cancelling: false,
        cancelled: false,
        error: '',
        installedPath: '',
        warning: null,
      }
  const { installing } = itemInstaller
  useFocusTrap({
    containerRef: dialogRef,
    initialFocusRef: closeButtonRef,
    onClose,
    enabled: !zoomedImage && !descriptionOverlayOpen && !cancelDialogOpen,
  })

  useEffect(() => {
    if (!installing || installer.activeLangGroup !== item.langGroup) return
    const frame = window.requestAnimationFrame(() => installActionsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }))
    return () => window.cancelAnimationFrame(frame)
  }, [installer.activeLangGroup, installer.installing, installing, item.langGroup, loading])

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
      onClick={onClose}
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

          <PostDetailBody
            item={item}
            detail={detail}
            imageQuality={imageQuality}
            loading={loading}
            error={error}
            installing={installing}
            onZoom={setZoomedImage}
            onOverlayChange={handleDescriptionOverlay}
            onSearchHashtag={onSearchHashtag}
          />

          <p className="mt-5 border-t border-[#343b32] pt-3 text-xs text-[#a5ad9a]">
            {t('likes', { count: item.likes })} · {t('downloadsCount', { count: item.downloads })}
          </p>

          <div ref={installActionsRef}>
            <PostInstallActions
              downloadUrl={item.downloadUrl}
              canInstall={canInstall}
              operationBusy={installer.installing}
              installer={itemInstaller}
              installedEntry={installedEntry}
              onInstall={onInstall}
              onReinstall={onReinstall}
              onUninstall={onUninstall}
              onChooseGame={onChooseGame}
            />
          </div>

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
