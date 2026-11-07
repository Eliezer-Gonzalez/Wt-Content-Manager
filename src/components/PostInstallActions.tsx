import { Download } from 'lucide-react'
import { Button } from './ui/Button'
import { SkinDownloadProgress } from './SkinDownloadProgress'
import { useI18n } from '../i18n/I18nProvider'
import { formatNumber } from '../lib/format'
import type { SkinInstaller } from '../hooks/useSkinInstaller'

type Props = {
  downloadUrl?: string
  canInstall: boolean
  installer: SkinInstaller
  onInstall: () => void
  onChooseGame: () => void
}

export function PostInstallActions({
  downloadUrl,
  canInstall,
  installer,
  onInstall,
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

      {downloadUrl && !installing && (
        <Button
          variant="primary"
          className="mt-5 w-full"
          disabled={!canInstall}
          onClick={onInstall}
        >
          <Download size={16} />
          {t('installSkin')}
        </Button>
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
