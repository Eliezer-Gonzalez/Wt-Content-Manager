import { HardDriveDownload, PackageOpen } from 'lucide-react'
import { formatFileSize } from '../lib/format'
import type { DownloadOriginFilter, DownloadSortOrder } from '../lib/downloadLibrary'
import { useI18n } from '../i18n/I18nProvider'

type Props = {
  totalCount: number
  totalSizeBytes: number
  origin: DownloadOriginFilter
  sort: DownloadSortOrder
  onOriginChange: (value: DownloadOriginFilter) => void
  onSortChange: (value: DownloadSortOrder) => void
}

export function DownloadsLibraryControls({ totalCount, totalSizeBytes, origin, sort, onOriginChange, onSortChange }: Props) {
  const { t, locale } = useI18n()

  return (
    <div className="mb-3.5 mt-5 flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-[#aeb6a7]" aria-live="polite">
        <span className="inline-flex items-center gap-1.5"><PackageOpen size={14} aria-hidden="true" />{t('downloadsLibraryCount', { count: totalCount })}</span>
        <span className="inline-flex items-center gap-1.5"><HardDriveDownload size={14} aria-hidden="true" />{t('downloadsLibraryTotal', { size: formatFileSize(totalSizeBytes, locale) })}</span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-2 text-xs text-[#a1a99b]">
          <span>{t('downloadsFilterLabel')}</span>
          <select className="min-h-9 max-w-full border border-[#343b32] bg-wt-panel px-2.5 text-xs text-[#d3d7ca] focus-visible:outline-2 focus-visible:outline-olive" value={origin} onChange={event => onOriginChange(event.target.value as DownloadOriginFilter)}>
            <option value="all">{t('downloadsFilterAll')}</option>
            <option value="app">{t('downloadsFilterApp')}</option>
            <option value="external">{t('downloadsFilterExternal')}</option>
          </select>
        </label>
        <label className="flex items-center gap-2 text-xs text-[#a1a99b]">
          <span>{t('downloadsSortLabel')}</span>
          <select className="min-h-9 max-w-full border border-[#343b32] bg-wt-panel px-2.5 text-xs text-[#d3d7ca] focus-visible:outline-2 focus-visible:outline-olive" value={sort} onChange={event => onSortChange(event.target.value as DownloadSortOrder)}>
            <option value="recent">{t('downloadsSortRecent')}</option>
            <option value="oldest">{t('downloadsSortOldest')}</option>
            <option value="largest">{t('downloadsSortLargest')}</option>
            <option value="smallest">{t('downloadsSortSmallest')}</option>
          </select>
        </label>
      </div>
    </div>
  )
}
