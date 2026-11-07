import { Bookmark, ExternalLink, Star } from 'lucide-react'
import { Button } from './ui/Button'
import { relativeDate } from '../lib/formatDate'
import { formatNumber } from '../lib/format'
import type { WtLiveItem } from '../wtLive'
import type { TranslationKey, TranslationParams } from '../i18n/I18nProvider'

type Props = {
  item: WtLiveItem
  locale: string
  isSaved: boolean
  imageHeight?: number
  masonry?: boolean
  onImageRatio?: (ratio: number) => void
  t: (key: TranslationKey, params?: TranslationParams) => string
  onOpen: (item: WtLiveItem) => void
  onToggleSaved: (item: WtLiveItem) => void
}

export function PostCard({ item, locale, isSaved, imageHeight, masonry = false, onImageRatio, t, onOpen, onToggleSaved }: Props) {
  return (
    <article className={`group flex min-w-0 flex-col border border-[#30372f] bg-wt-panel transition-colors hover:border-[#687354] ${masonry ? 'h-auto' : 'h-full'}`}>
      <div className="relative">
        <button
          type="button"
          tabIndex={-1}
          aria-hidden="true"
          style={imageHeight ? { height: imageHeight } : undefined}
          className={`relative block w-full overflow-hidden bg-[#1a201b] text-left ${masonry ? 'min-h-[150px]' : 'h-[190px] max-[720px]:h-[170px] max-[420px]:h-[180px]'}`}
          onClick={() => onOpen(item)}
        >
          {item.imageUrl && (
            <img
              src={item.imageUrl}
              alt=""
              className={masonry ? 'relative block h-auto max-h-[440px] w-full object-contain' : 'absolute inset-0 size-full object-contain'}
              loading="lazy"
              onLoad={event => {
                const { naturalWidth, naturalHeight } = event.currentTarget
                if (naturalWidth > 0 && naturalHeight > 0) onImageRatio?.(naturalWidth / naturalHeight)
              }}
            />
          )}
          <span className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-transparent"/>
          <span className="absolute left-2.5 top-2.5 bg-[#1a201bdc] px-2 py-1 text-[10px] tracking-[.1em] text-[#e2e5d9]">{t('camouflage')}</span>
          <span className="absolute bottom-2.5 right-2.5 flex items-center gap-1 text-[11px] text-[#e4e2d4]">
            <Star size={12} className="text-[#bcc793]" fill="currentColor"/>
            <span className="sr-only">{t('likes', { count: item.likes })}</span>
            <span aria-hidden="true">{formatNumber(item.likes, locale)}</span>
          </span>
        </button>
        <Button
          variant="icon"
          className={`absolute right-2 top-2 size-9 border border-[#596154] bg-[#171c18c9] ${isSaved ? 'text-[#c7d39d]' : 'text-[#d4d8cc]'}`}
          onClick={() => onToggleSaved(item)}
          aria-label={isSaved ? t('removeFavorite') : t('addFavorite')}
          aria-pressed={isSaved}
        >
          <Bookmark size={16} fill={isSaved ? 'currentColor' : 'none'}/>
        </Button>
      </div>
      <button
        type="button"
        className="flex w-full flex-1 flex-col px-3 pb-3 pt-3 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#87976a]"
        onClick={() => onOpen(item)}
        aria-label={t('viewPostAria', { title: item.title || t('postFallbackTitle', { id: item.id }) })}
      >
        <span className="flex items-start justify-between gap-2">
          <strong className="min-w-0 line-clamp-3 break-words font-display text-[19px] font-semibold leading-tight text-[#e2e4da]">{item.title || t('postFallbackTitle', { id: item.id })}</strong>
          <span className="shrink-0 pt-1 text-[10px] text-[#a1a99b]">{relativeDate(item.createdAt, locale)}</span>
        </span>
        <span className="mb-3 mt-1.5 block truncate text-xs text-[#bdc99e]">{item.fileName ?? t('camouflageForGame')}</span>
        <span className="mt-auto flex items-center justify-between gap-2 border-t border-[#333a32] pt-2.5 text-[11px] text-[#a2aa9c]">
          <span className="min-w-0 truncate">{t('by')} <b className="font-medium text-[#bbc1b2]">{item.author || t('unknownAuthor')}</b></span>
          <span className="flex shrink-0 items-center gap-1.5 text-[#bdc99e]">{t('viewPost')} <ExternalLink size={13}/></span>
        </span>
      </button>
    </article>
  )
}
