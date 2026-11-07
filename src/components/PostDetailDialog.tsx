import { Download, ExternalLink, LoaderCircle, Shield, X } from 'lucide-react'
import { Button } from './ui/Button'
import { PostDetailSkeleton } from './PostDetailSkeleton'
import type { WtLiveDetail, WtLiveItem } from '../wtLive'

type Props = {
  item: WtLiveItem
  detail: WtLiveDetail | null
  loading: boolean
  error: string
  t: (key: string) => string
  canInstall: boolean
  installing: boolean
  installError: string
  installedPath: string
  onInstall: () => void
  onChooseGame: () => void
  onClose: () => void
}

export function PostDetailDialog({ item, detail, loading, error, t, canInstall, installing, installError, installedPath, onInstall, onChooseGame, onClose }: Props) {
  const hasImages = detail?.description.some(block => block.type === 'image') ?? false
  return <div className="fixed inset-0 z-50 grid place-items-center bg-black/80 p-4" onClick={onClose}>
    <section className="relative max-h-[90dvh] w-full max-w-[620px] overflow-y-auto border border-[#46503f] bg-wt-panel" role="dialog" aria-modal="true" aria-labelledby="post-detail-title" onClick={event => event.stopPropagation()}>
      <Button variant="icon" className="sticky right-2 top-2 z-10 float-right -mb-9 mr-2 border border-[#454d42] bg-[#151a16]" onClick={onClose} aria-label={t('close')}><X size={18}/></Button>
      <div className="px-7 pb-7 pt-8 max-[420px]:px-5">
        <p className="flex items-center gap-2 text-[10px] tracking-[.14em] text-[#a0aa8a]"><Shield size={13}/>{t('detailSource')}</p>
        <h2 id="post-detail-title" className="mt-4 font-display text-4xl font-semibold leading-tight text-[#e6e7dd] max-[420px]:text-3xl">{item.title}</h2>
        <p className="mb-5 mt-1.5 text-xs text-[#bdc99e]">{item.fileName ?? t('camouflage')} · {t('by')} {item.author}</p>
        {loading ? <PostDetailSkeleton label={t('detailLoading')}/> : error ? <p className="my-6 text-sm leading-relaxed text-amber-200" role="alert">{error}</p> : <div className="space-y-4 text-sm leading-7 text-[#c0c5bb]">
          {hasImages ? detail?.description.map((block, index) => block.type === 'image'
            ? <img className="my-3 h-auto max-h-[65vh] w-full object-contain" key={`${block.src}-${index}`} src={block.src} alt={block.alt} loading="lazy"/>
            : <p key={index}>{block.text}</p>)
            : <>{item.imageUrl && <img className="my-3 h-auto max-h-[65vh] w-full object-contain" src={item.imageUrl} alt={item.title} loading="lazy"/>}<p>{item.description || t('noDescription')}</p></>}
        </div>}
        <p className="mt-5 border-t border-[#343b32] pt-3 text-xs text-[#a5ad9a]">{item.likes} {t('likes')} · {item.downloads} {t('downloadsCount')}</p>
        {item.downloadUrl && <button type="button" className="mt-5 flex min-h-11 w-full items-center justify-center gap-2 bg-olive px-4 py-2 text-sm font-semibold text-[#1c2319] hover:bg-[#bdc99e] disabled:cursor-wait disabled:opacity-60" disabled={installing || !canInstall} onClick={onInstall}>{installing ? <LoaderCircle size={16} className="animate-spin"/> : <Download size={16}/>} {installing ? t('skinInstalling') : t('installSkin')}</button>}
        {item.downloadUrl && !canInstall && <button type="button" className="mt-2 w-full text-center text-xs text-[#bdc99e] hover:text-[#dce5c4]" onClick={onChooseGame}>{t('skinNeedsGamePath')}</button>}
        {installError && <p role="alert" className="mt-3 text-sm text-amber-200">{installError}</p>}
        {installedPath && <p role="status" className="mt-3 break-all border border-[#424c3b] bg-[#252c23] p-3 text-xs leading-5 text-[#d5dfbd]">{t('skinInstalled')}<br/><span className="text-[#aeb99e]">{installedPath}</span></p>}
        {detail?.commentsUrl && <a className="mt-4 inline-flex items-center gap-1.5 text-sm text-[#bdc99e] hover:text-[#dce5c4]" href={detail.commentsUrl} target="_blank" rel="noreferrer">{t('readComments')} <ExternalLink size={13}/></a>}
      </div>
    </section>
  </div>
}
