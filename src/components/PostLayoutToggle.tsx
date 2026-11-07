import { Columns3, LayoutGrid } from 'lucide-react'
import type { PostLayout } from '../hooks/usePostLayout'

type Props = {
  value: PostLayout
  onChange: (layout: PostLayout) => void
  t: (key: string) => string
}

export function PostLayoutToggle({ value, onChange, t }: Props) {
  return <div className="flex items-center border border-[#343b32] bg-wt-panel p-0.5" role="group" aria-label={t('postLayout')}>
    <button type="button" onClick={() => onChange('justified')} aria-pressed={value === 'justified'} title={t('layoutJustified')} className={`flex min-h-8 items-center gap-1.5 px-2 text-xs transition-colors ${value === 'justified' ? 'bg-[#394231] text-[#e0e6d1]' : 'text-[#a1a99b] hover:text-[#e0e6d1]'}`}><Columns3 size={14}/><span className="max-[900px]:hidden">{t('layoutJustified')}</span></button>
    <button type="button" onClick={() => onChange('masonry')} aria-pressed={value === 'masonry'} title={t('layoutMasonry')} className={`flex min-h-8 items-center gap-1.5 px-2 text-xs transition-colors ${value === 'masonry' ? 'bg-[#394231] text-[#e0e6d1]' : 'text-[#a1a99b] hover:text-[#e0e6d1]'}`}><LayoutGrid size={14}/><span className="max-[900px]:hidden">{t('layoutMasonry')}</span></button>
  </div>
}
