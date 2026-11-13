import { useState } from 'react'
import { Check, Download, RefreshCw, Trash2 } from 'lucide-react'
import { openUrl } from '@tauri-apps/plugin-opener'
import { Button } from './ui/Button'
import { AppTooltip } from './ui/AppTooltip'
import { SkinDownloadProgress } from './SkinDownloadProgress'
import { ConfirmReinstallModal } from './ConfirmReinstallModal'
import { useI18n } from '../i18n/I18nContext'
import { formatNumber } from '../lib/format'
import { isTauriRuntime } from '../lib/gameInstall'
import type { SkinInstaller } from '../hooks/useSkinInstaller'
import type { InstalledSkin } from '../lib/localLibrary'

type Props = {
  downloadUrl?: string
  canInstall: boolean
  operationBusy?: boolean
  installer: SkinInstaller
  installedEntry?: InstalledSkin | null
  onInstall: () => void
  onReinstall: (entry: InstalledSkin) => void
  onUninstall?: (entry: InstalledSkin) => void
  onChooseGame: () => void
}

export function PostInstallActions({
  downloadUrl,
  canInstall,
  operationBusy = false,
  installer,
  installedEntry,
  onInstall,
  onReinstall,
  onUninstall,
  onChooseGame,
}: Props) {
  const [reinstallTarget, setReinstallTarget] = useState<InstalledSkin | null>(null)
  const [referenceLinkError, setReferenceLinkError] = useState(false)
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

  const warningMessages = warning ? [
    ...(warning.skippedFiles > 0
      ? [warning.skippedExecutables > 0
        ? t('skinWarningSkippedWithExecutables', {
            count: warning.skippedFiles,
            executables: formatNumber(warning.skippedExecutables, locale),
          })
        : t('skinWarningSkipped', { count: warning.skippedFiles })]
      : []),
    ...(warning.missingTextureCount > 0
      ? [t('skinWarningMissingTextures', {
          count: formatNumber(warning.missingTextureCount, locale),
          files: warning.missingTextureNames.join(', '),
        })]
      : []),
  ] : []
  const installedByApp = Boolean(installedEntry?.item)

  async function openReference(url: string) {
    setReferenceLinkError(false)
    try {
      if (isTauriRuntime) await openUrl(url)
      else window.open(url, '_blank', 'noopener,noreferrer')
    } catch {
      setReferenceLinkError(true)
    }
  }

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
            <AppTooltip content={installedEntry.path} className="mt-0.5 w-full">
              <div className="w-full"><span className="block w-full truncate text-[11px] text-[#9baa87]">{installedEntry.folderName || installedEntry.path}</span></div>
            </AppTooltip>
          </div>
        </div>
      )}

      {downloadUrl && !installing && (
        <div className={installedEntry ? 'mt-3 flex flex-col gap-2' : 'mt-5'}>
          <Button
            variant={installedEntry ? 'secondary' : 'primary'}
            className="w-full"
            disabled={!canInstall || operationBusy}
            onClick={() => installedByApp ? setReinstallTarget(installedEntry!) : onInstall()}
          >
            {installedByApp ? <RefreshCw size={16} /> : <Download size={16} />}
            {t(installedByApp ? 'reinstallSkin' : installedEntry ? 'skinDuplicateInstallCopy' : 'installSkin')}
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
        <p role="alert" className="mt-3 text-sm text-amber-200">{error}</p>
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
          {warningMessages.map((warningMessage, index) => (
            <p
              key={`${index}-${warningMessage}`}
              role="status"
              className="mt-2 border border-[#4a4731] bg-[#24221a] p-3 text-xs leading-5 text-[#dcd4a8]"
            >
              {warningMessage}
            </p>
          ))}
          {warning && warning.missingTextureCount > 0 && (
            <div className="mt-2 border border-[#4a4731] bg-[#24221a] p-3 text-xs leading-5 text-[#dcd4a8]">
              <span className="mr-2">{t('skinWarningReferences')}:</span>
              <button type="button" className="mr-3 underline underline-offset-2 hover:text-[#f0d98e]" onClick={() => void openReference('https://wiki.warthunder.com/cdk/creation_camo')}>
                {t('skinWarningGuideLink')}
              </button>
              <button type="button" className="underline underline-offset-2 hover:text-[#f0d98e]" onClick={() => void openReference('https://live.warthunder.com/rules/')}>
                {t('skinWarningRulesLink')}
              </button>
              {referenceLinkError && <span className="mt-1 block text-amber-200" role="alert">{t('settingsAboutLinkFailed')}</span>}
            </div>
          )}
        </>
      )}
      <ConfirmReinstallModal
        entry={installedByApp ? reinstallTarget : null}
        onClose={() => setReinstallTarget(null)}
        onConfirm={() => {
          if (!reinstallTarget) return
          onReinstall(reinstallTarget)
          setReinstallTarget(null)
        }}
      />
    </>
  )
}
