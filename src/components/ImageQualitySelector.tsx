import { useId } from 'react'
import { useI18n } from '../i18n/I18nContext'
import type { ImageQualityMode } from '../lib/imageQuality'

type Props = {
  value: ImageQualityMode
  onChange: (value: ImageQualityMode) => void
}

const options = [
  { value: 'optimized', title: 'imageQualityOptimized', description: 'imageQualityOptimizedDescription' },
  { value: 'high', title: 'imageQualityHigh', description: 'imageQualityHighDescription' },
] as const

export function ImageQualitySelector({ value, onChange }: Props) {
  const { t } = useI18n()
  const groupId = useId()

  return (
    <fieldset className="grid min-w-0 gap-3 md:grid-cols-2">
      <legend className="sr-only">{t('imageQualityTitle')}</legend>
      {options.map(option => (
        <label
          key={option.value}
          className={`flex min-w-0 cursor-pointer items-start gap-3 border p-3.5 transition-colors focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-olive ${value === option.value ? 'border-[#87976a] bg-[#293027]' : 'border-[#3a4237] bg-[#191e19] hover:border-[#59664a]'}`}
        >
          <input
            className="mt-1 size-4 shrink-0 accent-[#a8b485]"
            type="radio"
            name={groupId}
            value={option.value}
            checked={value === option.value}
            onChange={() => onChange(option.value)}
          />
          <span className="min-w-0">
            <span className="block text-sm font-semibold text-[#e0e3d8]">{t(option.title)}</span>
            <span className="mt-1 block text-xs leading-5 text-[#aab2a4]">{t(option.description)}</span>
          </span>
        </label>
      ))}
    </fieldset>
  )
}
