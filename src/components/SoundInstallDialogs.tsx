import { SoundActionConfirmDialog } from './SoundActionConfirmDialog'
import { SoundExistingModDecisionDialog } from './SoundExistingModDecisionDialog'
import type { SoundLibraryController } from '../hooks/useSoundLibrary'
import type { ExistingSoundModAction, SoundPackage } from '../lib/sounds'
import { useI18n } from '../i18n/I18nProvider'

type Props = {
  library: SoundLibraryController
  pendingInstall: SoundPackage | null
  pendingExistingMod: SoundPackage | null
  confirmRestore: boolean
  busy: boolean
  onConfirm: () => void
  onConfirmExistingMod: (action: ExistingSoundModAction) => void
  onClose: () => void
}

export function SoundInstallDialogs({
  library, pendingInstall, pendingExistingMod, confirmRestore, busy,
  onConfirm, onConfirmExistingMod, onClose,
}: Props) {
  const { t } = useI18n()
  const restoreOriginal = Boolean(library.status?.originalBackupAvailable)

  return (
    <>
      {(pendingInstall || confirmRestore) && (
        <SoundActionConfirmDialog
          title={t(pendingInstall ? 'confirmSoundInstall' : restoreOriginal ? 'confirmSoundRestore' : 'confirmSoundUninstall')}
          description={pendingInstall
            ? t('confirmSoundInstallDescription', { title: pendingInstall.title || pendingInstall.archiveName })
            : t(restoreOriginal ? 'confirmSoundRestoreDescription' : 'confirmSoundUninstallDescription')}
          actionLabel={t(pendingInstall ? 'soundInstallPackage' : restoreOriginal ? 'soundRestore' : 'soundUninstall')}
          busy={busy}
          busyLabel={busy ? t(pendingInstall ? 'soundInstallWorking' : restoreOriginal ? 'soundRestoreWorking' : 'soundUninstallWorking') : undefined}
          busyDescription={busy ? t(pendingInstall ? 'soundInstallWorkingDescription' : restoreOriginal ? 'soundRestoreWorkingDescription' : 'soundUninstallWorkingDescription') : undefined}
          onConfirm={onConfirm}
          onClose={onClose}
        />
      )}
      {pendingExistingMod && (
        <SoundExistingModDecisionDialog
          title={t('soundExistingModTitle')}
          description={t('soundExistingModDescription', { title: pendingExistingMod.title || pendingExistingMod.archiveName })}
          backupLabel={t('soundExistingModBackup')}
          deleteLabel={t('soundExistingModDelete')}
          busy={busy}
          busyLabel={busy ? t('soundInstallWorking') : undefined}
          busyDescription={busy ? t('soundInstallWorkingDescription') : undefined}
          onBackup={() => onConfirmExistingMod('backup')}
          onDelete={() => onConfirmExistingMod('delete')}
          onClose={onClose}
        />
      )}
    </>
  )
}
