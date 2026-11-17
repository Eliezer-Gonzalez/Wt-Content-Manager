import { GameSetupModal } from './GameSetupModal'
import { ConfirmUninstallModal } from './ConfirmUninstallModal'
import { ConfirmRemoveMissingSkinModal } from './ConfirmRemoveMissingSkinModal'
import { ConfirmRemoveFavoriteModal } from './ConfirmRemoveFavoriteModal'
import { DownloadCancelConfirmDialog } from './DownloadCancelConfirmDialog'
import { LegalNoticeDialog } from './LegalNoticeDialog'
import { ImageQualitySetupDialog } from './ImageQualitySetupDialog'
import { SkinRepairDialog } from './SkinRepairDialog'
import type { useGameInstallation } from '../hooks/useGameInstallation'
import type { useLocalLibrary } from '../hooks/useLocalLibrary'
import type { useLegalNotice } from '../hooks/useLegalNotice'
import type { useImageQualityPreference } from '../hooks/useImageQualityPreference'
import type { useDownloadCancellation } from '../hooks/useDownloadCancellation'
import type { useSkinLinkRepair } from '../hooks/useSkinLinkRepair'
import type { WtLiveItem } from '../lib/wtLive'
import { useI18n } from '../i18n/I18nContext'

type Props = {
  gameSetup: ReturnType<typeof useGameInstallation>
  library: ReturnType<typeof useLocalLibrary>
  skinRepair: ReturnType<typeof useSkinLinkRepair>
  legalNotice: ReturnType<typeof useLegalNotice>
  imageQuality: ReturnType<typeof useImageQualityPreference>
  cancellation: ReturnType<typeof useDownloadCancellation>
  favoriteToRemove: WtLiveItem | null
  onFavoriteToRemoveChange: (item: WtLiveItem | null) => void
  keepWindowControlsVisible: boolean
}

export function AppSystemDialogs({
  gameSetup, library, legalNotice, imageQuality, cancellation, skinRepair,
  favoriteToRemove, onFavoriteToRemoveChange, keepWindowControlsVisible,
}: Props) {
  const { t } = useI18n()

  return (
    <>
      <GameSetupModal
        open={gameSetup.isOpen && !legalNotice.isOpen && !imageQuality.isSetupRequired}
        loading={gameSetup.loading}
        error={gameSetup.error}
        installations={gameSetup.installations}
        selected={gameSetup.selected}
        onSelect={gameSetup.selectInstallation}
        onConfirm={gameSetup.confirmInstallation}
        onRescan={() => void gameSetup.scan()}
        onChooseManual={() => void gameSetup.chooseManual(t('gameSetupPickerTitle'))}
        onClose={gameSetup.closeSetup}
      />
      <ConfirmUninstallModal
        entry={library.uninstallTarget}
        busy={library.uninstalling}
        error={library.uninstallError}
        uninstalledFolder={library.uninstalledFolder}
        onDismissNotice={library.dismissUninstalledNotice}
        onConfirm={() => void library.confirmUninstall()}
        onClose={library.cancelUninstall}
      />
      <ConfirmRemoveMissingSkinModal
        entry={library.skinRecordToRemove}
        onConfirm={library.confirmRemoveMissingSkin}
        onClose={library.cancelRemoveMissingSkin}
      />
      <SkinRepairDialog
        open={skinRepair.dialogOpen}
        candidates={skinRepair.candidates}
        library={library.library}
        autoLinked={skinRepair.autoLinked}
        baselineCount={skinRepair.baselineCount}
        resolving={skinRepair.resolving}
        error={skinRepair.error}
        onConfirm={candidate => void skinRepair.confirm(candidate)}
        onClose={skinRepair.close}
      />
      <ConfirmRemoveFavoriteModal
        item={favoriteToRemove}
        onClose={() => onFavoriteToRemoveChange(null)}
        onConfirm={() => {
          if (!favoriteToRemove) return
          library.toggleFavorite(favoriteToRemove)
          onFavoriteToRemoveChange(null)
        }}
      />
      {cancellation.pendingKind && (
        <DownloadCancelConfirmDialog
          onContinue={cancellation.continueDownload}
          onConfirmCancel={cancellation.confirmCancellation}
          onDismiss={cancellation.dismissCancellation}
        />
      )}
      <LegalNoticeDialog
        open={legalNotice.isOpen}
        required={legalNotice.isRequired}
        keepWindowControlsVisible={keepWindowControlsVisible}
        onAcknowledge={legalNotice.acknowledge}
        onClose={legalNotice.closeNotice}
      />
      <ImageQualitySetupDialog
        open={imageQuality.isSetupRequired && !legalNotice.isOpen}
        keepWindowControlsVisible={keepWindowControlsVisible}
        initialQuality={imageQuality.quality}
        onConfirm={imageQuality.setQuality}
      />
    </>
  )
}
