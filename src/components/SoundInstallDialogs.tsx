import { SoundActionConfirmDialog } from './SoundActionConfirmDialog'
import { SoundExistingModDecisionDialog } from './SoundExistingModDecisionDialog'
import type { SoundLibraryController } from '../hooks/useSoundLibrary'
import type { ExistingSoundModAction, SoundPackage } from '../lib/sounds'
import { useI18n } from '../i18n/I18nContext'

type Props = {
  library: SoundLibraryController
  pendingInstall: SoundPackage | null
  pendingExistingMod: SoundPackage | null
  confirmRestore: boolean
  confirmUninstall: boolean
  chooseUninstallAction: boolean
  uninstallBusy: boolean
  busy: boolean
  onConfirm: () => void
  onConfirmExistingMod: (action: ExistingSoundModAction) => void
  onConfirmUninstall: () => void
  onRestoreInstead: () => void
  onUninstallInstead: () => void
  onClose: () => void
}

export function SoundInstallDialogs({
  library, pendingInstall, pendingExistingMod, confirmRestore, confirmUninstall, chooseUninstallAction, uninstallBusy, busy,
  onConfirm, onConfirmExistingMod, onConfirmUninstall, onRestoreInstead, onUninstallInstead, onClose,
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
      {confirmUninstall && !restoreOriginal && (
        <SoundActionConfirmDialog
          title={t('confirmSoundUninstall')}
          description={t('confirmSoundUninstallDescription')}
          actionLabel={t('soundUninstall')}
          busy={busy}
          busyLabel={busy ? t('soundUninstallWorking') : undefined}
          busyDescription={busy ? t('soundUninstallWorkingDescription') : undefined}
          onConfirm={onConfirmUninstall}
          onClose={onClose}
        />
      )}
      {chooseUninstallAction && restoreOriginal && (
        <SoundExistingModDecisionDialog
          title={t('soundUninstallChoiceTitle')}
          description={t('soundUninstallChoiceDescription')}
          warningText={t('soundUninstallChoiceWarning')}
          backupLabel={t('soundRestore')}
          deleteLabel={t('soundUninstall')}
          busy={busy}
          busyLabel={busy ? t(uninstallBusy ? 'soundUninstallWorking' : 'soundRestoreWorking') : undefined}
          busyDescription={busy ? t(uninstallBusy ? 'soundUninstallWorkingDescription' : 'soundRestoreWorkingDescription') : undefined}
          onBackup={onRestoreInstead}
          onDelete={onUninstallInstead}
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
