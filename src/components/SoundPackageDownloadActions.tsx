import { Check, Download, Pause, Play } from 'lucide-react'
import { Button } from './ui/Button'
import { useI18n } from '../i18n/I18nProvider'
import { formatFileSize } from '../lib/format'
import type { SoundDownloadProgress } from '../lib/sounds'
import type { WtLiveItem } from '../lib/wtLive'

type Props = {
  item: WtLiveItem
  canDownload: boolean
  downloaded: boolean
  downloadBusy: boolean
  downloading: boolean
  progress: SoundDownloadProgress | null
  downloadError: string
  onDownload: (item: WtLiveItem) => void
  onTogglePause: () => void
  onCancel: () => void
}

export function SoundPackageDownloadActions({
  item, canDownload, downloaded, downloadBusy, downloading, progress, downloadError,
  onDownload, onTogglePause, onCancel,
}: Props) {
  const { t, locale } = useI18n()
  const downloadedBytes = progress?.downloadedBytes ?? 0
  const totalBytes = progress?.totalBytes ?? null
  const percent = totalBytes ? Math.min(100, Math.floor((downloadedBytes / totalBytes) * 100)) : null

  if (downloaded) {
    return (
      <div className="flex flex-wrap items-center gap-2 border border-[#586b41] bg-[#202a1d] px-3 py-3 text-sm text-[#c4d79d]" role="status">
        <span className="inline-flex shrink-0 items-center gap-1.5 border border-[#6f8252] bg-[#1e271b] px-2 py-1 text-[10px] font-bold tracking-[.08em] text-[#b4d882]">
          <Check size={12} aria-hidden="true" />{t('soundDownloadedBadge')}
        </span>
        <span>{t('soundPackageDownloaded')}</span>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <Button variant="primary" className="w-full" disabled={!canDownload || downloadBusy} onClick={() => onDownload(item)}>
        <Download size={15} aria-hidden="true" />{t(downloading ? 'soundDownloading' : 'soundDownloadPackage')}
      </Button>
      {!canDownload && <p className="mb-0 text-xs text-[#a5ad9a]">{t('soundDesktopRequired')}</p>}
      {downloading && (
        <div className="space-y-2 border border-[#343b32] bg-[#1b211b] p-3">
          <div className="flex justify-between gap-2 text-xs text-[#bac2b0]">
            <span>{percent == null ? t('soundDownloading') : `${percent}%`}</span>
            <span>{formatFileSize(downloadedBytes, locale)}{totalBytes ? ` / ${formatFileSize(totalBytes, locale)}` : ''}</span>
          </div>
          <div className="h-1.5 bg-[#30372f]" role="progressbar" aria-valuenow={percent ?? undefined} aria-valuemin={0} aria-valuemax={100}>
            <div className="h-full bg-olive transition-[width]" style={{ width: `${percent ?? 0}%` }} />
          </div>
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="quiet" onClick={onTogglePause} aria-label={t(progress?.paused ? 'skinResume' : 'skinPause')}>
              {progress?.paused ? <Play size={14} /> : <Pause size={14} />}{t(progress?.paused ? 'skinResume' : 'skinPause')}
            </Button>
            <Button size="sm" variant="danger" onClick={onCancel}>{t('skinCancel')}</Button>
          </div>
        </div>
      )}
      {downloadError && <p className="mb-0 text-xs text-amber-200" role="alert">{downloadError}</p>}
    </div>
  )
}
