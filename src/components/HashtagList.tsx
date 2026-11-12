import { useI18n } from '../i18n/I18nContext'
import { Button } from './ui/Button'

type Props = {
  hashtags: string[]
  disabled?: boolean
  id?: string
  onSelect: (hashtag: string) => void
}

export function HashtagList({ hashtags, disabled = false, id = 'post-hashtags-heading', onSelect }: Props) {
  const { t } = useI18n()
  if (hashtags.length === 0) return null

  return (
    <section className="mt-6 border-t border-[#343b32] pt-4" aria-labelledby={id}>
      <h3 id={id} className="mb-3 text-xs font-semibold uppercase tracking-[.12em] text-[#aeb990]">
        {t('hashtags')}
      </h3>
      <div className="flex flex-wrap gap-2">
        {hashtags.map(tag => (
          <Button
            key={tag}
            size="sm"
            variant="secondary"
            disabled={disabled}
            onClick={() => onSelect(tag)}
            className="border-[#46513e] bg-[#283026] px-2.5 py-1 text-xs text-[#d2dcc1] hover:border-[#9eae7b] hover:bg-[#343d2e]"
          >
            #{tag}
          </Button>
        ))}
      </div>
    </section>
  )
}
