import { LoaderCircle, Pause, Play, X } from 'lucide-react'
import { Button } from './ui/Button'
import { useI18n } from '../i18n/I18nProvider'
import { formatFileSize } from '../lib/format'
import type { SkinInstallProgress } from '../lib/skins'
import type { SoundDownloadProgress } from '../lib/sounds'

type Props = {
  contentType: 'camouflage' | 'sound'
  skinProgress?: SkinInstallProgress | null
  soundProgress?: SoundDownloadProgress | null
  cancelling?: boolean
  onTogglePause: () => void
  onCancel: () => void
}

export function PostCardDownloadProgress({ contentType, skinProgress, soundProgress, cancelling = false, onTogglePause, onCancel }: Props) {
  const { t, locale } = useI18n()
  const progress = contentType === 'sound' ? soundProgress : skinProgress
  if (!progress) return null

  const downloading = contentType === 'sound' || progress.phase === 'downloading'
  const paused = progress.paused
  const extracting = contentType === 'camouflage' && skinProgress?.phase === 'extracting'
  const preparing = contentType === 'camouflage' && skinProgress?.phase === 'preparing'
  const percentage = progress.totalBytes
    ? Math.min(100, Math.floor(progress.downloadedBytes / progress.totalBytes * 100))
    : extracting ? 100 : null
  const indeterminate = percentage == null && contentType === 'camouflage'
  const phaseLabel = contentType === 'sound'
    ? t('soundDownloading')
    : extracting ? t('skinExtracting') : preparing ? t('skinPreparing') : paused ? t('skinDownloadPaused') : t('skinDownloading')

  return (
    <section className="border-t border-[#333a32] bg-[#20261f] px-3 pb-3 pt-2.5" aria-live="polite" aria-label={t('downloadProgressForPost')}>
      <div className="flex items-center justify-between gap-2 text-[11px] text-[#d8dfcc]">
        <span className="flex min-w-0 items-center gap-1.5 truncate">
          {(preparing || extracting) && <LoaderCircle size={12} className="shrink-0 animate-spin text-[#c1ce9f] motion-reduce:animate-none" aria-hidden="true" />}
          {cancelling ? t('skinCancelling') : phaseLabel}
        </span>
        {percentage != null && <span className="shrink-0 tabular-nums">{percentage}%</span>}
      </div>
      <div className="mt-2 h-1.5 overflow-hidden bg-[#141915]" role="progressbar" aria-label={t('downloadProgressForPost')} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percentage ?? undefined}>
        <div className={`h-full bg-[#aabd7c] transition-[width] duration-200 ${indeterminate ? 'w-1/3 animate-pulse motion-reduce:animate-none' : ''}`} style={percentage == null ? { width: '0%' } : { width: `${percentage}%` }} />
      </div>
      {downloading && (
        <div className="mt-1.5 flex items-center justify-between gap-2 text-[10px] text-[#99a18f]">
          <span>{formatFileSize(progress.downloadedBytes, locale)}{progress.totalBytes ? ` / ${formatFileSize(progress.totalBytes, locale)}` : ''}</span>
          <div className="flex gap-1">
            <Button variant="quiet" size="sm" className="!min-h-7 !px-2 !py-1" disabled={cancelling} onClick={onTogglePause} aria-label={t(paused ? 'skinResume' : 'skinPause')}>
              {paused ? <Play size={12} aria-hidden="true" /> : <Pause size={12} aria-hidden="true" />}
            </Button>
            <Button variant="danger" size="sm" className="!min-h-7 !px-2 !py-1" disabled={cancelling} onClick={onCancel} aria-label={t('skinCancel')}>
              <X size={12} aria-hidden="true" />
            </Button>
          </div>
        </div>
      )}
    </section>
  )
}
