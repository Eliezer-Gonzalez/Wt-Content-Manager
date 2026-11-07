import { Bookmark, ExternalLink, Star } from 'lucide-react'
import { Button } from './ui/Button'
import { relativeDate } from '../lib/formatDate'
import type { WtLiveItem } from '../wtLive'

type Props = {
  item: WtLiveItem
  locale: string
  isSaved: boolean
  t: (key: string) => string
  onOpen: (item: WtLiveItem) => void
  onToggleSaved: (item: WtLiveItem) => void
}

export function PostCard({ item, locale, isSaved, t, onOpen, onToggleSaved }: Props) {
  return <article className="group min-w-0 border border-[#30372f] bg-wt-panel transition-colors hover:border-[#687354]">
    <div className="relative">
      <button type="button" className="relative block h-[154px] w-full overflow-hidden bg-[#1a201b] text-left max-[720px]:h-[132px] max-[420px]:h-[170px]" onClick={() => onOpen(item)} aria-label={`${t('viewPost')}: ${item.title}`}>
        {item.imageUrl && <img src={item.imageUrl} alt="" className="absolute inset-0 size-full object-cover" loading="lazy"/>}
        <span className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-transparent"/>
        <span className="absolute left-2.5 top-2.5 bg-[#1a201bdc] px-2 py-1 text-[10px] tracking-[.1em] text-[#e2e5d9]">{t('camouflage')}</span>
        <span className="absolute bottom-2.5 right-2.5 flex items-center gap-1 text-[11px] text-[#e4e2d4]"><Star size={12} className="text-[#bcc793]" fill="currentColor"/>{item.likes}</span>
      </button>
      <Button variant="icon" className={`absolute right-2 top-2 size-9 border border-[#596154] bg-[#171c18c9] ${isSaved ? 'text-[#c7d39d]' : 'text-[#d4d8cc]'}`} onClick={() => onToggleSaved(item)} aria-label={isSaved ? t('removeFavorite') : t('addFavorite')} aria-pressed={isSaved}><Bookmark size={16} fill={isSaved ? 'currentColor' : 'none'}/></Button>
    </div>
    <button type="button" className="block w-full px-3 pb-3 pt-3 text-left" onClick={() => onOpen(item)}>
      <span className="flex items-start justify-between gap-2"><strong className="line-clamp-2 font-display text-[19px] font-semibold leading-tight text-[#e2e4da]">{item.title}</strong><span className="shrink-0 pt-1 text-[10px] text-[#a1a99b]">{relativeDate(item.createdAt, locale)}</span></span>
      <span className="mb-3 mt-1.5 block text-xs text-[#bdc99e]">{item.fileName ?? t('camouflageForGame')}</span>
      <span className="flex items-center justify-between border-t border-[#333a32] pt-2.5 text-[11px] text-[#a2aa9c]"><span>{t('by')} <b className="font-medium text-[#bbc1b2]">{item.author}</b></span><span className="flex items-center gap-1.5 text-[#bdc99e]">{t('viewPost')} <ExternalLink size={13}/></span></span>
    </button>
  </article>
}
