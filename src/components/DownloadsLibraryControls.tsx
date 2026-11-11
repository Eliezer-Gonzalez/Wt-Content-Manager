import type { DownloadOriginFilter, DownloadSortOrder, SoundDownloadStatusFilter } from '../lib/downloadLibrary'
import { HardDriveDownload, PackageOpen } from 'lucide-react'
import { formatFileSize } from '../lib/format'
import { useI18n } from '../i18n/I18nProvider'

type SummaryProps = { totalCount: number; totalSizeBytes: number; kind?: 'camouflages' | 'sounds' }

export function DownloadsLibrarySummary({ totalCount, totalSizeBytes, kind = 'camouflages' }: SummaryProps) {
  const { t, locale } = useI18n()
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-[#aeb6a7]" aria-live="polite">
      <span className="inline-flex items-center gap-1.5"><PackageOpen size={14} aria-hidden="true" />{t(kind === 'sounds' ? 'soundDownloadsLibraryCount' : 'downloadsLibraryCount', { count: totalCount })}</span>
      <span className="inline-flex items-center gap-1.5"><HardDriveDownload size={14} aria-hidden="true" />{t(kind === 'sounds' ? 'soundDownloadsLibraryTotal' : 'downloadsLibraryTotal', { size: formatFileSize(totalSizeBytes, locale) })}</span>
    </div>
  )
}

type Props = {
  origin: DownloadOriginFilter
  sort: DownloadSortOrder
  onOriginChange: (value: DownloadOriginFilter) => void
  onSortChange: (value: DownloadSortOrder) => void
}

export function DownloadsLibraryControls({ origin, sort, onOriginChange, onSortChange }: Props) {
  const { t } = useI18n()

  return (
    <div className="flex flex-wrap items-center gap-2">
      <select aria-label={t('downloadsFilterLabel')} className="h-11 min-w-36 max-w-full border border-[#343b32] bg-wt-panel px-2.5 text-xs text-[#d3d7ca] focus-visible:outline-2 focus-visible:outline-olive" value={origin} onChange={event => onOriginChange(event.target.value as DownloadOriginFilter)}>
        <option value="all">{t('downloadsFilterAll')}</option>
        <option value="app">{t('downloadsFilterApp')}</option>
        <option value="external">{t('downloadsFilterExternal')}</option>
      </select>
      <select aria-label={t('downloadsSortLabel')} className="h-11 min-w-36 max-w-full border border-[#343b32] bg-wt-panel px-2.5 text-xs text-[#d3d7ca] focus-visible:outline-2 focus-visible:outline-olive" value={sort} onChange={event => onSortChange(event.target.value as DownloadSortOrder)}>
        <option value="recent">{t('downloadsSortRecent')}</option>
        <option value="oldest">{t('downloadsSortOldest')}</option>
        <option value="largest">{t('downloadsSortLargest')}</option>
        <option value="smallest">{t('downloadsSortSmallest')}</option>
      </select>
    </div>
  )
}

type SoundProps = {
  statusFilter: SoundDownloadStatusFilter
  statusAvailable: boolean
  sort: DownloadSortOrder
  onStatusFilterChange: (value: SoundDownloadStatusFilter) => void
  onSortChange: (value: DownloadSortOrder) => void
}

export function SoundDownloadsLibraryControls({
  statusFilter, statusAvailable, sort, onStatusFilterChange, onSortChange,
}: SoundProps) {
  const { t } = useI18n()

  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        aria-label={t('soundDownloadsFilterLabel')}
        className="h-11 min-w-36 max-w-full border border-[#343b32] bg-wt-panel px-2.5 text-xs text-[#d3d7ca] focus-visible:outline-2 focus-visible:outline-olive"
        value={statusFilter}
        onChange={event => onStatusFilterChange(event.target.value as SoundDownloadStatusFilter)}
      >
        <option value="all">{t('soundDownloadsFilterAll')}</option>
        <option value="active" disabled={!statusAvailable}>{t('soundDownloadsFilterActive')}</option>
        <option value="inactive" disabled={!statusAvailable}>{t('soundDownloadsFilterInactive')}</option>
      </select>
      <select
        aria-label={t('downloadsSortLabel')}
        className="h-11 min-w-36 max-w-full border border-[#343b32] bg-wt-panel px-2.5 text-xs text-[#d3d7ca] focus-visible:outline-2 focus-visible:outline-olive"
        value={sort}
        onChange={event => onSortChange(event.target.value as DownloadSortOrder)}
      >
        <option value="recent">{t('downloadsSortRecent')}</option>
        <option value="oldest">{t('downloadsSortOldest')}</option>
        <option value="largest">{t('downloadsSortLargest')}</option>
        <option value="smallest">{t('downloadsSortSmallest')}</option>
      </select>
    </div>
  )
}
