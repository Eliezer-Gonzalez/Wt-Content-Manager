import { LoaderCircle, Pause, Play, X } from 'lucide-react'
import { Button } from './ui/Button'
import type { SkinInstallProgress } from '../lib/skins'
import { formatFileSize } from '../lib/format'
import { getDownloadPercentage } from '../lib/downloadProgress'
import { useI18n } from '../i18n/I18nContext'

type Props = {
  progress: SkinInstallProgress | null
  paused: boolean
  cancelling: boolean
  onTogglePause: () => void
  onCancel: () => void
}

export function SkinDownloadProgress({ progress, paused, cancelling, onTogglePause, onCancel }: Props) {
  const { t, locale } = useI18n()
  const downloading = progress?.phase === 'downloading'
  const isExtracting = progress?.phase === 'extracting'
  const isPreparing = !progress || progress.phase === 'preparing'
  const percentage = downloading && progress.totalBytes
    ? getDownloadPercentage(progress.downloadedBytes, progress.totalBytes)
    : isExtracting ? 100 : isPreparing ? 0 : null
  const status = isExtracting ? t('skinExtracting')
    : isPreparing ? t('skinPreparing')
      : paused ? t('skinDownloadPaused') : t('skinDownloading')

  return <section className="mt-5 border border-[#424c3b] bg-[#20261f] p-4" aria-live="polite" aria-label={t('skinDownloadProgress')}>
    <div className="flex items-center justify-between gap-3">
      <p className="mb-0 flex items-center gap-2 text-sm font-medium text-[#d8dfcc]">
        {isExtracting || isPreparing ? <LoaderCircle size={15} className="animate-spin text-[#c1ce9f]"/> : <span className={`size-2 rounded-full ${paused ? 'bg-[#a4a995]' : 'bg-[#aabd7c]'}`}/>}
        {cancelling ? t('skinCancelling') : status}
      </p>
      {downloading && percentage !== null && <span className="text-xs tabular-nums text-[#d0d9bf]">{percentage}%</span>}
    </div>
    <div className="mt-3 h-2 overflow-hidden bg-[#141915]" role="progressbar" aria-label={t('skinDownloadProgress')} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percentage ?? undefined} aria-valuetext={percentage === null ? formatFileSize(progress?.downloadedBytes ?? 0, locale) : `${percentage}%`}>
      <div className={`h-full bg-[#aabd7c] transition-[width] duration-200 ${percentage === null ? 'w-1/3 animate-pulse' : isExtracting ? 'animate-pulse' : ''}`} style={percentage === null ? undefined : { width: `${percentage}%` }}/>
    </div>
    {downloading && <div className="mt-2 flex justify-between text-[11px] text-[#99a18f]">
      <span>
        {progress?.totalBytes
          ? t('downloadProgressFraction', {
              downloaded: formatFileSize(progress.downloadedBytes, locale),
              total: formatFileSize(progress.totalBytes, locale),
            })
          : formatFileSize(progress?.downloadedBytes ?? 0, locale)}
      </span>
      <span>{t('skinDownloadSizeNote')}</span>
    </div>}
    {isExtracting && (
      <div className="mt-3 flex items-center gap-2 border border-[#4c5742] bg-[#1a201b] px-3 py-2 text-xs text-[#cad5b8]">
        <LoaderCircle size={14} className="shrink-0 animate-spin text-[#c1ce9f]" />
        <span>{t('skinExtractingBanner')}</span>
      </div>
    )}
    <div className="mt-4 flex justify-end gap-2">
      <Button
        variant="secondary"
        size="sm"
        disabled={!downloading || cancelling}
        onClick={onTogglePause}
      >
        {paused ? <Play size={14}/> : <Pause size={14}/>}{paused ? t('skinResume') : t('skinPause')}
      </Button>
      <Button
        variant="danger"
        size="sm"
        disabled={!downloading || cancelling}
        onClick={onCancel}
      >
        <X size={14}/>{t('skinCancel')}
      </Button>
    </div>
  </section>
}
