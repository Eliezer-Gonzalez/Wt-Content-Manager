import { useState } from 'react'
import { LoaderCircle, RefreshCw } from 'lucide-react'
import { Button } from './ui/Button'
import { SoundActionConfirmDialog } from './SoundActionConfirmDialog'
import { useI18n } from '../i18n/I18nProvider'
import type { SoundLibraryController } from '../hooks/useSoundLibrary'
import type { SoundPackage } from '../lib/sounds'

type Props = {
  packageInfo: SoundPackage
  library: SoundLibraryController
  canInstall: boolean
  onConfirmingChange?: (confirming: boolean) => void
}

export function SoundReinstallAction({ packageInfo, library, canInstall, onConfirmingChange }: Props) {
  const { t } = useI18n()
  const [checking, setChecking] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [statusWarning, setStatusWarning] = useState<'running' | 'unknown' | null>(null)
  const installing = library.installingId === packageInfo.id

  async function requestReinstall() {
    if (!canInstall || checking || installing) return
    setChecking(true)
    setStatusWarning(null)
    try {
      const status = await library.refreshStatus()
      if (status?.processStatus !== 'stopped') {
        setStatusWarning(status?.processStatus === 'running' ? 'running' : 'unknown')
        return
      }
      setConfirming(true)
      onConfirmingChange?.(true)
    } catch {
      setStatusWarning('unknown')
    } finally {
      setChecking(false)
    }
  }

  async function confirmReinstall() {
    const succeeded = await library.install(packageInfo.id)
    if (succeeded) {
      setConfirming(false)
      onConfirmingChange?.(false)
    }
  }

  return (
    <div className="mt-3 space-y-2">
      {statusWarning && (
        <p className="border border-[#766638] bg-[#302b1d] px-3 py-2 text-xs leading-5 text-[#dfd5b6]" role="alert">
          <strong className="font-semibold text-[#f1e6c5]">{t('soundGameName')}</strong>{' '}
          {t(statusWarning === 'running' ? 'soundInstallBlockedRunning' : 'soundInstallStatusUnknown')}
        </p>
      )}
      {library.error && <p className="mb-0 text-xs text-amber-200" role="alert">{library.error}</p>}
      <Button variant="secondary" className="w-full" disabled={!canInstall || checking || installing} onClick={() => void requestReinstall()}>
        {checking || installing
          ? <LoaderCircle size={15} className="animate-spin motion-reduce:animate-none" aria-hidden="true" />
          : <RefreshCw size={15} aria-hidden="true" />}
        {t(checking ? 'checkingSoundStatus' : 'soundReinstallPackage')}
      </Button>
      {confirming && (
        <SoundActionConfirmDialog
          title={t('confirmSoundReinstall')}
          description={t('confirmSoundReinstallDescription', { title: packageInfo.title || packageInfo.archiveName })}
          actionLabel={t('soundReinstallPackage')}
          busy={installing}
          busyLabel={installing ? t('soundInstallWorking') : undefined}
          busyDescription={installing ? t('soundInstallWorkingDescription') : undefined}
          onConfirm={() => void confirmReinstall()}
          onClose={() => {
            setConfirming(false)
            onConfirmingChange?.(false)
          }}
        />
      )}
    </div>
  )
}
