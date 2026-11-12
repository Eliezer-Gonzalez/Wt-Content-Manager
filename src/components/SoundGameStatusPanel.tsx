import { FolderOpen, HardDrive, LoaderCircle, RefreshCw } from 'lucide-react'
import { useI18n } from '../i18n/I18nProvider'
import type { SoundModStatus } from '../lib/sounds'
import { Button } from './ui/Button'

type Props = {
  gamePath?: string
  status: SoundModStatus | null
  statusLoading: boolean
  checkingStatus: boolean
  installWarning: 'running' | 'unknown' | null
  openingModFolder: boolean
  modFolderError: boolean
  busy: boolean
  onRefreshStatus: () => void
  onOpenModFolder: () => void
  onChooseGame: () => void
}

export function SoundGameStatusPanel({
  gamePath, status, statusLoading, checkingStatus, installWarning,
  openingModFolder, modFolderError, busy, onRefreshStatus, onOpenModFolder, onChooseGame,
}: Props) {
  const { t } = useI18n()
  const isChecking = checkingStatus || statusLoading
  const statusKey = isChecking
    ? 'checkingSoundStatus'
    : status?.processStatus === 'running'
      ? 'soundProcessRunning'
      : status?.processStatus === 'stopped'
        ? 'soundProcessStopped'
        : 'soundProcessUnknown'
  const statusTone = isChecking
    ? 'text-[#e6d39d]'
    : status?.processStatus === 'running'
      ? 'text-[#f0b6a1]'
      : status?.processStatus === 'stopped'
        ? 'text-[#d3e2ad]'
        : 'text-[#d4cba9]'

  return (
    <>
      {installWarning && (
        <p className="mb-4 border border-[#766638] bg-[#302b1d] px-3 py-2.5 text-sm leading-5 text-[#dfd5b6]" role="alert">
          <strong className="font-semibold text-[#f1e6c5]">{t('soundGameName')}</strong>{' '}
          {t(installWarning === 'running' ? 'soundInstallBlockedRunning' : 'soundInstallStatusUnknown')}
        </p>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-2 border border-[#343b32] bg-[#1d231d] px-3 py-3 text-xs text-[#bac2b0]">
        {gamePath ? (
          <>
            <span role="status" aria-live="polite" aria-busy={isChecking} className={`inline-flex items-center gap-2 text-sm font-semibold ${statusTone}`}>
              <HardDrive size={15} aria-hidden="true" />
              <span>{t('soundGameStatus')}:</span>
              <strong>{t(statusKey)}</strong>
            </span>
            <span className="text-[#798473]">·</span>
            <span>{t('soundInstalledBanks', { count: status?.installedBanks ?? 0 })}</span>
            <Button size="sm" variant="quiet" className="ml-auto" onClick={onRefreshStatus} disabled={isChecking}>
              <RefreshCw size={14} className={isChecking ? 'animate-spin motion-reduce:animate-none' : ''} aria-hidden="true" />
              {t(isChecking ? 'checkingSoundStatus' : 'refreshSoundStatus')}
            </Button>
            <Button size="sm" variant="secondary" onClick={onOpenModFolder} disabled={openingModFolder || busy}>
              {openingModFolder ? <LoaderCircle size={14} className="animate-spin motion-reduce:animate-none" aria-hidden="true" /> : <FolderOpen size={14} aria-hidden="true" />}
              {t(openingModFolder ? 'openSoundModFolderWorking' : 'openSoundModFolder')}
            </Button>
          </>
        ) : (
          <>
            <span>{t('soundChooseGame')}</span>
            <Button size="sm" variant="secondary" className="ml-auto" onClick={onChooseGame}>{t('chooseGame')}</Button>
          </>
        )}
      </div>
      {modFolderError && <p className="mb-4 text-xs text-amber-200" role="alert">{t('openSoundModFolderFailed')}</p>}
    </>
  )
}
