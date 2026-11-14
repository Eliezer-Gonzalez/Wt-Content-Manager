import { formatFileSize } from '../lib/format'
import { useI18n } from '../i18n/I18nContext'

export function DownloadSizeBadge({ bytes }: { bytes: number }) {
  const { t, locale } = useI18n()
  const size = formatFileSize(bytes, locale)
  const label = t('downloadSizeAccessible', { size })

  return (
    <span
      aria-label={label}
      title={label}
      className="inline-flex shrink-0 items-center whitespace-nowrap border border-[#635d3c] bg-[#28271d] px-1.5 py-0.5 text-xs font-medium leading-4 tabular-nums text-[#d4c779]"
    >
      {size}
    </span>
  )
}
