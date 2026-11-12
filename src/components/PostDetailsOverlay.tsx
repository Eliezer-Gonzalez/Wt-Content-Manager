import { PostDetailDialog } from './PostDetailDialog'
import { SoundPostDetailDialog } from './SoundPostDetailDialog'
import type { SkinInstaller } from '../hooks/useSkinInstaller'
import type { SoundLibraryController } from '../hooks/useSoundLibrary'
import type { useLocalLibrary } from '../hooks/useLocalLibrary'
import type { useGameInstallation } from '../hooks/useGameInstallation'
import type { useDownloadCancellation } from '../hooks/useDownloadCancellation'
import type { ImageQualityMode } from '../lib/imageQuality'
import type { WtLiveDetail, WtLiveItem } from '../lib/wtLive'

type Props = {
  selected: WtLiveItem | null
  detail: WtLiveDetail | null
  detailLoading: boolean
  detailError: string
  imageQuality: ImageQualityMode
  canInstall: boolean
  soundLibrary: SoundLibraryController
  skinInstaller: SkinInstaller
  library: ReturnType<typeof useLocalLibrary>
  gameSetup: ReturnType<typeof useGameInstallation>
  cancellation: ReturnType<typeof useDownloadCancellation>
  downloadableSoundLangGroups: ReadonlySet<number>
  onSearchSoundHashtag: (tag: string) => void
  onSearchSkinHashtag: (tag: string) => void
  onClose: () => void
}

export function PostDetailsOverlay({
  selected, detail, detailLoading, detailError, imageQuality, canInstall, soundLibrary,
  skinInstaller, library, gameSetup, cancellation, downloadableSoundLangGroups,
  onSearchSoundHashtag, onSearchSkinHashtag, onClose,
}: Props) {
  if (selected?.contentType === 'sound') {
    const activePackage = soundLibrary.packages.find(packageInfo =>
      packageInfo.id === soundLibrary.status?.activePackageId && packageInfo.langGroup === selected.langGroup,
    ) ?? null

    return (
      <SoundPostDetailDialog
        item={selected}
        detail={detail}
        loading={detailLoading}
        error={detailError}
        imageQuality={imageQuality}
        canDownload={canInstall}
        downloadedLangGroups={downloadableSoundLangGroups}
        downloadBusy={soundLibrary.downloadingId != null}
        downloadingId={soundLibrary.downloadingId}
        progress={soundLibrary.downloadProgress ? { ...soundLibrary.downloadProgress, paused: soundLibrary.paused } : null}
        downloadError={soundLibrary.error}
        activePackage={activePackage}
        soundLibrary={{ ...soundLibrary, cancelDownload: cancellation.requestSoundCancellation }}
        canInstallPackage={canInstall}
        cancelDialogOpen={cancellation.pendingKind === 'sound'}
        onDownload={item => void soundLibrary.download(item)}
        onTogglePause={() => void soundLibrary.togglePause()}
        onCancel={cancellation.requestSoundCancellation}
        onSearchHashtag={onSearchSoundHashtag}
        onClose={onClose}
      />
    )
  }

  if (!selected) return null
  const installedEntry = library.installedSkins.find(entry => entry.item?.id === selected.id) ?? null

  return (
    <PostDetailDialog
      item={selected}
      detail={detail}
      loading={detailLoading}
      error={detailError}
      imageQuality={imageQuality}
      canInstall={canInstall}
      installer={{ ...skinInstaller, cancel: cancellation.requestSkinCancellation }}
      cancelDialogOpen={cancellation.pendingKind === 'skin'}
      installedEntry={installedEntry}
      onInstall={() => {
        if (!gameSetup.gameInstall) { gameSetup.openSetup(); return }
        void skinInstaller.install(selected)
      }}
      onReinstall={entry => void skinInstaller.install(selected, entry.folderName)}
      onUninstall={entry => { onClose(); library.requestUninstall(entry) }}
      onChooseGame={gameSetup.openSetup}
      onSearchHashtag={onSearchSkinHashtag}
      onClose={onClose}
    />
  )
}
