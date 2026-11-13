import { Pause, Play } from 'lucide-react'
import { Button } from './ui/Button'
import { useI18n } from '../i18n/I18nContext'
import { formatFileSize } from '../lib/format'
import { getDownloadPercentage } from '../lib/downloadProgress'
import type { SoundDownloadProgress } from '../lib/sounds'

type Props = {
  title: string
  progress: SoundDownloadProgress
  paused: boolean
  onTogglePause: () => void
  onCancel: () => void
}

export function SoundPackageUpdateProgress({ title, progress, paused, onTogglePause, onCancel }: Props) {
  const { t, locale } = useI18n()
  const percent = getDownloadPercentage(progress.downloadedBytes, progress.totalBytes)
  const downloading = progress.phase === 'downloading'
  return (
    <div className="mb-4 border border-[#766638] bg-[#302b1d] p-3" role="status" aria-live="polite">
      <p className="mb-2 break-words text-sm font-medium text-[#f1e6c5]">{t('soundUpdateProgressTitle', { title })}</p>
      {downloading ? (
        <>
          <div className="flex flex-wrap justify-between gap-x-3 gap-y-1 text-xs text-[#dfd5b6]">
            <span>{percent == null ? t('soundDownloading') : `${percent}%`}</span>
            <span>{formatFileSize(progress.downloadedBytes, locale)}{progress.totalBytes ? ` / ${formatFileSize(progress.totalBytes, locale)}` : ''}</span>
          </div>
          <div className="mt-2 h-1.5 bg-[#1b211b]" role="progressbar" aria-valuenow={percent ?? undefined} aria-valuemin={0} aria-valuemax={100}>
            <div className="h-full bg-olive transition-[width]" style={{ width: `${percent ?? 0}%` }} />
          </div>
          <div className="mt-2 flex flex-wrap justify-end gap-2">
            <Button size="sm" variant="quiet" onClick={onTogglePause} aria-label={t(paused ? 'skinResume' : 'skinPause')}>
              {paused ? <Play size={14} aria-hidden="true" /> : <Pause size={14} aria-hidden="true" />}{t(paused ? 'skinResume' : 'skinPause')}
            </Button>
            <Button size="sm" variant="danger" onClick={onCancel}>{t('skinCancel')}</Button>
          </div>
        </>
      ) : (
        <p className="mb-0 text-xs text-[#dfd5b6]">{t('soundUpdateValidating')}</p>
      )}
    </div>
  )
}
