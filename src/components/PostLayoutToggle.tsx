import { Columns3, LayoutGrid } from 'lucide-react'
import type { PostLayout } from '../hooks/usePostLayout'
import { useI18n } from '../i18n/I18nProvider'

type Props = {
  value: PostLayout
  onChange: (layout: PostLayout) => void
}

export function PostLayoutToggle({ value, onChange }: Props) {
  const { t } = useI18n()
  return (
    <div className="flex items-center border border-[#343b32] bg-wt-panel p-0.5" role="group" aria-label={t('postLayout')}>
      <button
        type="button"
        onClick={() => onChange('justified')}
        aria-pressed={value === 'justified'}
        aria-label={t('layoutJustified')}
        title={t('layoutJustified')}
        className={`flex min-h-9 min-w-9 items-center justify-center gap-1.5 px-2.5 text-xs transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#87976a] ${value === 'justified' ? 'bg-[#394231] text-[#e0e6d1]' : 'text-[#a1a99b] hover:text-[#e0e6d1]'}`}
      >
        <Columns3 size={14} aria-hidden="true" />
        <span className="max-[900px]:hidden">{t('layoutJustified')}</span>
      </button>
      <button
        type="button"
        onClick={() => onChange('masonry')}
        aria-pressed={value === 'masonry'}
        aria-label={t('layoutMasonry')}
        title={t('layoutMasonry')}
        className={`flex min-h-9 min-w-9 items-center justify-center gap-1.5 px-2.5 text-xs transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#87976a] ${value === 'masonry' ? 'bg-[#394231] text-[#e0e6d1]' : 'text-[#a1a99b] hover:text-[#e0e6d1]'}`}
      >
        <LayoutGrid size={14} aria-hidden="true" />
        <span className="max-[900px]:hidden">{t('layoutMasonry')}</span>
      </button>
    </div>
  )
}
