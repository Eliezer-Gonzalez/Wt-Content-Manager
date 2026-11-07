import { Check, Download, RefreshCw, Trash2 } from 'lucide-react'
import { Button } from './ui/Button'
import { SkinDownloadProgress } from './SkinDownloadProgress'
import { useI18n } from '../i18n/I18nProvider'
import { formatNumber } from '../lib/format'
import type { SkinInstaller } from '../hooks/useSkinInstaller'
import type { InstalledSkin } from '../lib/localLibrary'

type Props = {
  downloadUrl?: string
  canInstall: boolean
  installer: SkinInstaller
  installedEntry?: InstalledSkin | null
  onInstall: () => void
  onUninstall?: (entry: InstalledSkin) => void
  onChooseGame: () => void
}

export function PostInstallActions({
  downloadUrl,
  canInstall,
  installer,
  installedEntry,
  onInstall,
  onUninstall,
  onChooseGame,
}: Props) {
  const { t, locale } = useI18n()
  const {
    installing,
    progress,
    paused,
    cancelling,
    cancelled,
    error,
    installedPath,
    warning,
    togglePause,
    cancel,
  } = installer

  const warningMessage =
    warning && warning.skippedFiles > 0
      ? warning.skippedExecutables > 0
        ? t('skinWarningSkippedWithExecutables', {
            count: warning.skippedFiles,
            executables: formatNumber(warning.skippedExecutables, locale),
          })
        : t('skinWarningSkipped', { count: warning.skippedFiles })
      : null

  return (
    <>
      {downloadUrl && installing && (
        <SkinDownloadProgress
          progress={progress}
          paused={paused}
          cancelling={cancelling}
          onTogglePause={() => void togglePause()}
          onCancel={() => void cancel()}
        />
      )}

      {installedEntry && !installing && (
        <div className="mt-5 flex items-start gap-2.5 border border-[#4d5b3d] bg-[#1e261cf0] p-3 text-xs">
          <Check size={16} className="mt-0.5 shrink-0 text-[#a9ce6b]" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <strong className="block font-medium text-[#dce7cb]">{t('skinAlreadyInstalled')}</strong>
            <span className="mt-0.5 block truncate text-[11px] text-[#9baa87]" title={installedEntry.path}>
              {installedEntry.folderName || installedEntry.path}
            </span>
          </div>
        </div>
      )}

      {downloadUrl && !installing && (
        <div className={installedEntry ? 'mt-3 flex flex-col gap-2' : 'mt-5'}>
          <Button
            variant={installedEntry ? 'secondary' : 'primary'}
            className="w-full"
            disabled={!canInstall}
            onClick={onInstall}
          >
            {installedEntry ? <RefreshCw size={16} /> : <Download size={16} />}
            {t(installedEntry ? 'reinstallSkin' : 'installSkin')}
          </Button>

          {installedEntry && onUninstall && (
            <Button
              variant="danger"
              className="w-full"
              onClick={() => onUninstall(installedEntry)}
            >
              <Trash2 size={14} />
              {t('uninstallFromGame')}
            </Button>
          )}
        </div>
      )}

      {installedEntry && !downloadUrl && !installing && onUninstall && (
        <div className="mt-3">
          <Button
            variant="danger"
            className="w-full"
            onClick={() => onUninstall(installedEntry)}
          >
            <Trash2 size={14} />
            {t('uninstallFromGame')}
          </Button>
        </div>
      )}

      {downloadUrl && !canInstall && (
        <button
          type="button"
          className="mt-2 w-full text-center text-xs text-[#bdc99e] hover:text-[#dce5c4]"
          onClick={onChooseGame}
        >
          {t('skinNeedsGamePath')}
        </button>
      )}

      {error && (
        <p role="alert" className="mt-3 text-sm text-amber-200">
          {error}
        </p>
      )}
      {cancelled && (
        <p role="status" className="mt-3 border border-[#424c3b] bg-[#252c23] p-3 text-xs text-[#c5cfb0]">
          {t('skinDownloadCancelled')}
        </p>
      )}
      {installedPath && (
        <>
          <p
            role="status"
            className="mt-3 break-all border border-[#424c3b] bg-[#252c23] p-3 text-xs leading-5 text-[#d5dfbd]"
          >
            {t('skinInstalled')}
            <br />
            <span className="text-[#aeb99e]">{installedPath}</span>
          </p>
          {warningMessage && (
            <p
              role="status"
              className="mt-2 border border-[#4a4731] bg-[#24221a] p-3 text-xs leading-5 text-[#dcd4a8]"
            >
              {warningMessage}
            </p>
          )}
        </>
      )}
    </>
  )
}
