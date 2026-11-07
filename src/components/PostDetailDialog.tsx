import { useState } from 'react'
import { Download, ExternalLink, Shield, X } from 'lucide-react'
import { Button } from './ui/Button'
import { SkinDownloadProgress } from './SkinDownloadProgress'
import { PostDetailSkeleton } from './PostDetailSkeleton'
import { ImageLightbox } from './ImageLightbox'
import { getFullResolutionImageUrl } from '../wtLive'
import { openUrl } from '@tauri-apps/plugin-opener'
import type { WtLiveDetail, WtLiveItem } from '../wtLive'
import type { SkinInstallProgress } from '../skins'

type Props = {
  item: WtLiveItem
  detail: WtLiveDetail | null
  loading: boolean
  error: string
  t: (key: string) => string
  canInstall: boolean
  installing: boolean
  installProgress: SkinInstallProgress | null
  installPaused: boolean
  installCancelling: boolean
  installCancelled: boolean
  installError: string
  installedPath: string
  onInstall: () => void
  onPauseDownload: () => void
  onCancelDownload: () => void
  onChooseGame: () => void
  onClose: () => void
  onSearchHashtag: (hashtag: string) => void
}

export function PostDetailDialog({ item, detail, loading, error, t, canInstall, installing, installProgress, installPaused, installCancelling, installCancelled, installError, installedPath, onInstall, onPauseDownload, onCancelDownload, onChooseGame, onClose, onSearchHashtag }: Props) {
  const [zoomedImage, setZoomedImage] = useState<{ src: string; alt: string } | null>(null)
  const [commentError, setCommentError] = useState(false)
  const hasDescription = detail?.description.some(block => block.type === 'text') ?? false
  const hasInlineImages = detail?.description.some(block => block.type === 'image') ?? false
  const previewImageUrl = item.imageUrl ? getFullResolutionImageUrl(item.imageUrl) : null
  const cleanFallbackDescription = item.description.replace(/#[\p{L}\p{N}_-]+/gu, ' ').replace(/\s+/g, ' ').trim()

  async function handleOpenComments() {
    if (!detail?.commentsUrl) return
    setCommentError(false)
    try {
      const url = new URL(detail.commentsUrl)
      if (url.origin !== 'https://live.warthunder.com' || !url.pathname.startsWith('/post/')) throw new Error('Unexpected comments URL')
      if (canInstall) await openUrl(url.href)
      else window.open(url.href, '_blank', 'noopener,noreferrer')
    } catch {
      setCommentError(true)
    }
  }
  return <div className="fixed inset-0 z-50 grid place-items-center bg-black/80 p-4" onClick={() => { if (!installing) onClose() }}>
    <section className="relative max-h-[90dvh] w-full max-w-[620px] overflow-y-auto border border-[#46503f] bg-wt-panel" role="dialog" aria-modal="true" aria-labelledby="post-detail-title" onClick={event => event.stopPropagation()}>
      <Button variant="icon" className="sticky right-2 top-2 z-10 float-right -mb-9 mr-2 border border-[#454d42] bg-[#151a16]" onClick={onClose} disabled={installing} aria-label={t('close')}><X size={18}/></Button>
      <div className="px-7 pb-7 pt-8 max-[420px]:px-5">
        <p className="flex items-center gap-2 text-[10px] tracking-[.14em] text-[#a0aa8a]"><Shield size={13}/>{t('detailSource')}</p>
        <h2 id="post-detail-title" className="mt-4 font-display text-4xl font-semibold leading-tight text-[#e6e7dd] max-[420px]:text-3xl">{item.title}</h2>
        <p className="mb-5 mt-1.5 text-xs text-[#bdc99e]">{item.fileName ?? t('camouflage')} · {t('by')} {item.author}</p>
        {loading ? <PostDetailSkeleton label={t('detailLoading')}/> : error ? <p className="my-6 text-sm leading-relaxed text-amber-200" role="alert">{error}</p> : <>
          <section className="space-y-4 text-sm leading-7 text-[#c0c5bb]" aria-labelledby="post-description-heading">
            {hasDescription && <h3 id="post-description-heading" className="mb-0 border-l-2 border-[#87976a] pl-3 text-xs font-semibold uppercase tracking-[.12em] text-[#c8d1b6]">{t('description')}</h3>}
            {!hasInlineImages && previewImageUrl && <button type="button" className="my-3 block w-full cursor-zoom-in" onClick={() => setZoomedImage({ src: previewImageUrl, alt: item.title })} aria-label={t('enlargeImage')}><img className="h-auto max-h-[65vh] w-full object-contain" src={item.imageUrl} alt={item.title} loading="lazy"/></button>}
            {detail?.description.length ? detail.description.map((block, index) => block.type === 'image'
              ? <button type="button" className="my-3 block w-full cursor-zoom-in" key={`${block.src}-${index}`} onClick={() => setZoomedImage({ src: getFullResolutionImageUrl(block.src), alt: block.alt })} aria-label={t('enlargeImage')}><img className="h-auto max-h-[65vh] w-full object-contain" src={block.src} alt={block.alt} loading="lazy"/></button>
              : <p className="mb-0 whitespace-pre-line" key={index}>{block.text}</p>)
              : <p className="mb-0">{cleanFallbackDescription || t('noDescription')}</p>}
          </section>
          {!!detail?.hashtags.length && <section className="mt-6 border-t border-[#343b32] pt-4" aria-labelledby="post-hashtags-heading">
            <h3 id="post-hashtags-heading" className="mb-3 text-xs font-semibold uppercase tracking-[.12em] text-[#aeb990]">{t('hashtags')}</h3>
            <div className="flex flex-wrap gap-2">{detail.hashtags.map(tag => <button key={tag} type="button" onClick={() => onSearchHashtag(tag)} className="border border-[#46513e] bg-[#283026] px-2.5 py-1 text-xs text-[#d2dcc1] transition-colors hover:border-[#9eae7b] hover:bg-[#343d2e] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-olive">#{tag}</button>)}</div>
          </section>}
        </>}
        <p className="mt-5 border-t border-[#343b32] pt-3 text-xs text-[#a5ad9a]">{item.likes} {t('likes')} · {item.downloads} {t('downloadsCount')}</p>
        {item.downloadUrl && installing && <SkinDownloadProgress progress={installProgress} paused={installPaused} cancelling={installCancelling} t={t} onTogglePause={onPauseDownload} onCancel={onCancelDownload}/>}
        {item.downloadUrl && !installing && <button type="button" className="mt-5 flex min-h-11 w-full items-center justify-center gap-2 bg-olive px-4 py-2 text-sm font-semibold text-[#1c2319] hover:bg-[#bdc99e] disabled:cursor-wait disabled:opacity-60" disabled={!canInstall} onClick={onInstall}><Download size={16}/>{t('installSkin')}</button>}
        {item.downloadUrl && !canInstall && <button type="button" className="mt-2 w-full text-center text-xs text-[#bdc99e] hover:text-[#dce5c4]" onClick={onChooseGame}>{t('skinNeedsGamePath')}</button>}
        {installError && <p role="alert" className="mt-3 text-sm text-amber-200">{installError}</p>}
        {installCancelled && <p role="status" className="mt-3 border border-[#424c3b] bg-[#252c23] p-3 text-xs text-[#c5cfb0]">{t('skinDownloadCancelled')}</p>}
        {installedPath && <p role="status" className="mt-3 break-all border border-[#424c3b] bg-[#252c23] p-3 text-xs leading-5 text-[#d5dfbd]">{t('skinInstalled')}<br/><span className="text-[#aeb99e]">{installedPath}</span></p>}
        {detail?.commentsUrl && <button type="button" className="mt-4 inline-flex items-center gap-1.5 text-sm text-[#bdc99e] hover:text-[#dce5c4]" onClick={() => void handleOpenComments()}>{t('readComments')} <ExternalLink size={13}/></button>}
        {commentError && <p className="mt-2 text-xs text-amber-200" role="alert">{t('openLinkFailed')}</p>}
      </div>
    </section>
    {zoomedImage && <ImageLightbox src={zoomedImage.src} alt={zoomedImage.alt} closeLabel={t('close')} zoomInLabel={t('zoomIn')} zoomOutLabel={t('zoomOut')} onClose={() => setZoomedImage(null)}/>}
  </div>
}
