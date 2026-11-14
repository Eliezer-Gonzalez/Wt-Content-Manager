import { useEffect, useRef, useState } from 'react'
import { Bookmark, Check, Download, ExternalLink, Star } from 'lucide-react'
import { Button } from './ui/Button'
import { PostCardDownloadProgress } from './PostCardDownloadProgress'
import { formatFileSize, formatNumber, relativeDate } from '../lib/format'
import type { WtLiveItem } from '../lib/wtLive'
import type { SkinInstallProgress } from '../lib/skins'
import type { SoundDownloadProgress } from '../lib/sounds'
import { useI18n } from '../i18n/I18nContext'
import { useDownloadFileSize } from '../hooks/useDownloadFileSize'
import { DownloadSizeBadge } from './DownloadSizeBadge'

type Props = {
  item: WtLiveItem
  isSaved: boolean
  isInstalled?: boolean
  isDownloaded?: boolean
  contentType?: 'camouflage' | 'sound'
  showSave?: boolean
  masonry?: boolean
  skinProgress?: SkinInstallProgress | null
  soundProgress?: SoundDownloadProgress | null
  cancellingDownload?: boolean
  onToggleDownloadPause?: () => void
  onCancelDownload?: () => void
  onOpen: (item: WtLiveItem) => void
  onToggleSaved: (item: WtLiveItem) => void
}

export function PostCard({ item, isSaved, isInstalled, isDownloaded, contentType = 'camouflage', showSave = true, masonry = true, skinProgress, soundProgress, cancellingDownload, onToggleDownloadPause, onCancelDownload, onOpen, onToggleSaved }: Props) {
  const { t, locale } = useI18n()
  const { visibilityRef: fileSizeVisibilityRef, sizeBytes } = useDownloadFileSize(item.downloadUrl, item.fileSizeBytes)
  const postTitle = item.title || t('postFallbackTitle', { id: item.id })
  const fileSizeDescription = sizeBytes != null
    ? t('downloadSizeAccessible', { size: formatFileSize(sizeBytes, locale) })
    : undefined
  const [loadedUrl, setLoadedUrl] = useState<string | null>(null)
  const [favoriteGlow, setFavoriteGlow] = useState(false)
  const wasSavedRef = useRef(isSaved)
  const imageLoaded = Boolean(item.imageUrl && loadedUrl === item.imageUrl)
  const aspectRatio = Math.max(0.45, Math.min(2.5, item.imageAspectRatio ?? 1.6))

  useEffect(() => {
    const wasSaved = wasSavedRef.current
    wasSavedRef.current = isSaved
    if (!isSaved) {
      setFavoriteGlow(false)
      return
    }
    if (wasSaved) {
      return
    }
    setFavoriteGlow(true)
    const timer = window.setTimeout(() => setFavoriteGlow(false), 450)
    return () => window.clearTimeout(timer)
  }, [isSaved])

  return (
    <article ref={fileSizeVisibilityRef} className={`group flex min-w-0 flex-col border border-[#30372f] bg-wt-panel transition-colors hover:border-[#687354] ${masonry ? '' : 'h-full'}`}>
      <div className="relative">
        {/* Mouse-only shortcut: the title button below is the single keyboard/screen-reader control for opening the post. */}
        <div
          style={masonry ? { aspectRatio } : undefined}
          className={`relative block w-full cursor-pointer overflow-hidden bg-[#1a201b] text-left ${masonry ? '' : 'aspect-[16/10]'}`}
          onClick={() => onOpen(item)}
        >
          {!masonry && item.imageUrl && (
            <img
              src={item.imageUrl}
              alt=""
              aria-hidden="true"
              className={`absolute inset-0 size-full scale-110 object-cover blur-md transition-opacity duration-200 ${imageLoaded ? 'opacity-35' : 'opacity-0'}`}
            />
          )}
          {item.imageUrl && (
            <img
              src={item.imageUrl}
              alt=""
              className={`absolute inset-0 size-full ${masonry ? 'object-cover' : 'object-contain'} transition-opacity duration-200 ${imageLoaded ? 'opacity-100' : 'opacity-0'}`}
              loading="lazy"
              onLoad={() => setLoadedUrl(item.imageUrl ?? null)}
              onError={() => setLoadedUrl(item.imageUrl ?? null)}
            />
          )}
          <span className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-transparent"/>
          <div className="absolute left-2.5 top-2.5 flex flex-wrap items-center gap-1.5">
            <span className="bg-[#1a201bdc] px-2 py-1 text-[10px] tracking-[.1em] text-[#e2e5d9]">{t(contentType === 'sound' ? 'soundMod' : 'camouflage')}</span>
            {contentType === 'sound' && isDownloaded && (
              <span className="flex items-center gap-1 border border-[#6f8252] bg-[#1e271be8] px-2 py-1 text-[10px] font-bold tracking-[.08em] text-[#b4d882] shadow-sm backdrop-blur-xs">
                <Download size={11} aria-hidden="true" />{t('soundDownloadedBadge')}
              </span>
            )}
            {isInstalled && contentType !== 'sound' && (
              <span className="flex items-center gap-1 border border-[#6f8252] bg-[#1e271be8] px-2 py-1 text-[10px] font-bold tracking-[.08em] text-[#b4d882] shadow-sm backdrop-blur-xs">
                <Check size={11} strokeWidth={3} aria-hidden="true" />
                {t('installedBadge')}
              </span>
            )}
          </div>
          {isInstalled && contentType === 'sound' && (
            <span className="pointer-events-none absolute bottom-2.5 left-2.5 flex items-center gap-1 border border-[#6f8252] bg-[#1e271be8] px-2 py-1 text-[10px] font-bold tracking-[.08em] text-[#b4d882] shadow-sm backdrop-blur-xs">
              <Check size={11} strokeWidth={3} aria-hidden="true" />{t('soundActive')}
            </span>
          )}
          <span className="absolute bottom-2.5 right-2.5 flex items-center gap-1 text-[11px] text-[#e4e2d4]">
            <Star size={12} className="text-[#bcc793]" fill="currentColor"/>
            <span className="sr-only">{t('likes', { count: item.likes })}</span>
            <span aria-hidden="true">{formatNumber(item.likes, locale)}</span>
          </span>
        </div>
        {showSave && <Button
          variant="icon"
          className={`absolute right-2 top-2 size-9 border border-[#596154] bg-[#171c18c9] transition-transform duration-150 active:scale-95 ${isSaved ? 'text-[#c7d39d]' : 'text-[#d4d8cc]'}`}
          onClick={() => onToggleSaved(item)}
          aria-label={isSaved ? t('removeFavorite') : t('addFavorite')}
          aria-pressed={isSaved}
        >
          <Bookmark size={16} className={`transition-colors duration-200 ${favoriteGlow ? 'favorite-glow' : ''}`} fill={isSaved ? 'currentColor' : 'none'}/>
        </Button>}
      </div>
      <button
        type="button"
        className="flex w-full flex-1 flex-col px-3 pb-3 pt-3 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#87976a]"
        onClick={() => onOpen(item)}
        aria-label={[
          t('viewPostAria', { title: postTitle }),
          fileSizeDescription,
        ].filter(Boolean).join('. ')}
      >
        <span className="flex items-start justify-between gap-2">
          <strong className="min-w-0 line-clamp-3 break-words font-display text-[19px] font-semibold leading-tight text-[#e2e4da]">{item.title || t('postFallbackTitle', { id: item.id })}</strong>
          <span className="shrink-0 pt-1 text-[10px] text-[#a1a99b]">{relativeDate(item.createdAt, locale)}</span>
        </span>
        <span className="mb-3 mt-1.5 flex min-w-0 items-center gap-2">
          <span className="min-w-0 flex-1 truncate text-xs text-[#bdc99e]">{item.fileName || t(contentType === 'sound' ? 'soundMod' : 'camouflageForGame')}</span>
          {sizeBytes != null && <DownloadSizeBadge bytes={sizeBytes} />}
        </span>
        <span className="mt-auto flex items-center justify-between gap-2 border-t border-[#333a32] pt-2.5 text-[11px] text-[#a2aa9c]">
          <span className="min-w-0 truncate">{t('by')} <b className="font-medium text-[#bbc1b2]">{item.author || t('unknownAuthor')}</b></span>
          <span className="flex shrink-0 items-center gap-1.5 text-[#bdc99e]">{t('viewPost')} <ExternalLink size={13}/></span>
        </span>
      </button>
      {(skinProgress || soundProgress) && (
        <PostCardDownloadProgress
          contentType={contentType}
          skinProgress={skinProgress}
          soundProgress={soundProgress}
          cancelling={cancellingDownload}
          onTogglePause={onToggleDownloadPause ?? (() => {})}
          onCancel={onCancelDownload ?? (() => {})}
        />
      )}
    </article>
  )
}
