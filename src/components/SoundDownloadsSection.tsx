import { FolderOpen, LoaderCircle, RefreshCw, X } from 'lucide-react'
import { Button } from './ui/Button'
import { SoundInstallDialogs } from './SoundInstallDialogs'
import { SoundPackageCard } from './SoundPackageCard'
import { SoundPackageDownloadActions } from './SoundPackageDownloadActions'
import { SoundPackageUpdateDialog } from './SoundPackageUpdateDialog'
import { SoundPackageUpdateProgress } from './SoundPackageUpdateProgress'
import { SoundGameStatusPanel } from './SoundGameStatusPanel'
import { DownloadsLibrarySummary } from './DownloadsLibraryControls'
import { PaginatedGrid } from './PaginatedGrid'
import { AppTooltip } from './ui/AppTooltip'
import { useI18n } from '../i18n/I18nContext'
import { useSoundDownloadsActions } from '../hooks/useSoundDownloadsActions'
import type { SoundLibraryController } from '../hooks/useSoundLibrary'
import type { SoundPackage } from '../lib/sounds'
import type { WtLiveItem } from '../lib/wtLive'
import type { SoundPackageUpdateResult } from '../hooks/useSoundPackageUpdates'

type Props = {
  gamePath?: string
  library: SoundLibraryController
  packages: SoundPackage[]
  hasPackages: boolean
  onChooseGame: () => void
  onExploreSounds: () => void
  onOpenPost: (item: WtLiveItem) => void
  updateResults: Record<string, SoundPackageUpdateResult>
  onMarkUpdated: (packageId: string, revision: number, archiveName: string) => void
}

export function SoundDownloadsSection({
  gamePath, library, packages, hasPackages, updateResults, onMarkUpdated, onChooseGame, onExploreSounds, onOpenPost,
}: Props) {
  const { t } = useI18n()
  const actions = useSoundDownloadsActions({ gamePath, library, onMarkUpdated })
  const { activePackage } = actions

  return (
    <section className="mt-5 border-t border-[#30372f] pt-5" aria-labelledby="sound-downloads-title">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h2 id="sound-downloads-title" className="m-0 font-display text-2xl font-semibold text-[#e1e4d9]">
            {t('soundLibrary')}
          </h2>
          <p className="mb-0 mt-1 text-xs text-[#9fa89b]">
            {t('soundLibraryDescriptionPrefix')} <strong className="font-medium text-[#d3e2ad]">{t('soundLibraryLocalLabel')}</strong>; {t('soundLibraryDescriptionMiddle')} <strong className="font-medium text-[#d3e2ad]">{t('soundLibraryVerifiedBanks')}</strong> {t('soundLibraryDescriptionSuffix')}
          </p>
        </div>
      </div>
      <SoundGameStatusPanel
        gamePath={gamePath}
        status={library.status}
        statusLoading={library.statusLoading}
        checkingStatus={actions.checkingStatus}
        installWarning={actions.installStatusWarning}
        openingModFolder={actions.openingModFolder}
        modFolderError={actions.modFolderError}
        busy={actions.busy}
        onRefreshStatus={() => void actions.refreshStatus()}
        onOpenModFolder={() => void actions.openModFolder()}
        onChooseGame={onChooseGame}
      />
      <p className="mb-3 text-xs leading-5 text-[#9fa89b]">
        {t('soundPackageDeleteWarningPrefix')} <strong className="font-medium text-[#d3e2ad]">{t('soundPackageDeleteWarningHighlight')}</strong> {t('soundPackageDeleteWarningSuffix')}
      </p>
      {actions.packagesFolderError && <p className="mb-3 text-xs text-amber-200" role="alert">{t('soundPackageFolderOpenFailed')}</p>}

      {library.status?.backupAvailable && library.status.originalBackupAvailable && !activePackage && (
        <div className="mb-4 flex flex-wrap items-center gap-3 border border-[#41483d] bg-[#1d231d] px-3 py-3 text-sm text-[#c0c5bb]">
          <span className="min-w-0 flex-1">{t('soundBackupAvailable')}</span>
          <Button size="sm" variant="secondary" disabled={!actions.gameReady || actions.busy} onClick={actions.requestRestore}>{t('soundRestore')}</Button>
        </div>
      )}
      {activePackage && !packages.some(packageInfo => packageInfo.id === activePackage.id) && (
        <div className="mb-4 flex flex-wrap items-center gap-3 border border-[#586b41] bg-[#202a1d] px-3 py-2 text-xs text-[#c4d79d]">
          <span className="min-w-0 flex-1">{t('soundActivePackageFiltered')}</span>
          <Button size="sm" variant="secondary" disabled={!actions.gameReady || actions.busy} onClick={actions.requestUninstall}>{t('soundUninstall')}</Button>
        </div>
      )}
      {library.status?.activePackageId && !activePackage && (
        <div className="mb-4 flex flex-wrap items-center gap-3 border border-[#586b41] bg-[#202a1d] px-3 py-3 text-sm text-[#c4d79d]">
          <span className="min-w-0 flex-1">{t('soundActivePackageMissing')}</span>
          <Button size="sm" variant="danger" disabled={!actions.gameReady || actions.busy} onClick={actions.requestUninstall}>{t('soundUninstall')}</Button>
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <DownloadsLibrarySummary totalCount={library.packages.length} totalSizeBytes={actions.totalSizeBytes} kind="sounds" />
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-[#9fa89b]">{t('downloadsFilteredCount', { count: packages.length })}</span>
          <Button size="sm" variant="secondary" className="min-h-10" onClick={() => void actions.openPackagesFolder()} disabled={actions.openingPackagesFolder}>
            {actions.openingPackagesFolder ? <LoaderCircle size={13} className="animate-spin motion-reduce:animate-none" aria-hidden="true" /> : <FolderOpen size={13} aria-hidden="true" />}
            {t(actions.openingPackagesFolder ? 'soundPackageFolderOpening' : 'soundPackageFolderOpen')}
          </Button>
          <AppTooltip align="end" content={t(actions.scanningPackages || library.loading ? 'scanningSoundPackages' : 'rescanSoundPackages')}>
            <Button
              size="md"
              variant="secondary"
              className="size-10 min-w-10 !min-h-10 !px-0 !py-0"
              onClick={() => void actions.scanPackages()}
              disabled={library.loading || actions.scanningPackages}
              aria-label={t('rescanSoundPackages')}
              aria-busy={actions.scanningPackages || library.loading}
            >
              <RefreshCw size={15} className={actions.scanningPackages || library.loading ? 'animate-spin motion-reduce:animate-none' : ''} aria-hidden="true" />
            </Button>
          </AppTooltip>
        </div>
      </div>
      {library.downloadingItem && (
        <div className="mb-4 border border-[#586b41] bg-[#202a1d] p-3">
          <p className="mb-2 text-sm font-medium text-[#d4dfc0]">{library.downloadingItem.title}</p>
          <SoundPackageDownloadActions
            item={library.downloadingItem}
            canDownload
            downloaded={false}
            downloadBusy
            downloading
            progress={library.downloadProgress ? { ...library.downloadProgress, paused: library.paused } : null}
            downloadError=""
            onDownload={library.download}
            onTogglePause={() => void library.togglePause()}
            onCancel={() => void library.cancelDownload()}
          />
        </div>
      )}
      {library.updatePackageId && library.updateProgress && (
        <SoundPackageUpdateProgress
          title={library.packages.find(packageInfo => packageInfo.id === library.updatePackageId)?.title ?? library.updatePackageId}
          progress={{ ...library.updateProgress, paused: library.updatePaused }}
          paused={library.updatePaused}
          onTogglePause={() => void library.toggleUpdatePause()}
          onCancel={() => void library.cancelUpdate()}
        />
      )}
      {library.error && (
        <div className="mb-4 flex items-start justify-between gap-3 border border-[#766638] bg-[#302b1d] px-3 py-2.5 text-sm text-amber-100" role="alert">
          <p className="mb-0 min-w-0">{library.error}</p>
          <Button variant="icon" size="sm" className="-mr-1 -mt-1 shrink-0" onClick={library.dismissError} aria-label={t('close')}>
            <X size={15} aria-hidden="true" />
          </Button>
        </div>
      )}
      {actions.uninstallSuccess && (
        <div className="mb-4 flex items-center justify-between gap-3 border border-[#586b41] bg-[#202a1d] px-3 py-2.5 text-sm text-[#d3e2ad]" role="status" aria-live="polite">
          <p className="mb-0">{t('soundUninstallSuccess')}</p>
          <Button variant="icon" size="sm" className="shrink-0" onClick={actions.dismissUninstallSuccess} aria-label={t('close')}>
            <X size={15} aria-hidden="true" />
          </Button>
        </div>
      )}
      {library.loading && library.packages.length === 0 ? (
        <div className="py-7 text-center text-sm text-[#9fa89b]">{t('loading')}</div>
      ) : packages.length === 0 ? (
        hasPackages ? (
          <div className="grid min-h-24 place-items-center border border-dashed border-[#3a4238] text-sm text-[#9fa89b]">{t('noMatchingDownloads')}</div>
        ) : (
          <div className="grid min-h-24 place-items-center gap-3 border border-dashed border-[#3a4238] px-4 py-6 text-center text-sm text-[#9fa89b]">
            <p className="mb-0">{t('soundNoPackages')}</p>
            <Button variant="secondary" size="sm" onClick={onExploreSounds}>{t('sounds')}</Button>
          </div>
        )
      ) : (
        <PaginatedGrid
          items={packages}
          resetKey={packages.map(packageInfo => packageInfo.id).join('|')}
          getKey={packageInfo => packageInfo.id}
          gridClassName="grid grid-cols-3 gap-3 max-[1100px]:grid-cols-2 max-[720px]:grid-cols-1"
          renderItem={packageInfo => (
            <SoundPackageCard
              packageInfo={packageInfo}
              status={library.status}
              updateStatus={updateResults[packageInfo.id]?.revision === packageInfo.revision ? updateResults[packageInfo.id] : undefined}
              gameReady={actions.gameReady}
              checkingStatus={actions.checkingInstallStatus}
              busy={actions.busy || actions.checkingInstallStatus}
              onInstall={item => void actions.requestInstall(item)}
              onUninstall={actions.requestUninstall}
              onOpenPost={onOpenPost}
              onRequestUpdate={actions.requestUpdate}
            />
          )}
        />
      )}

      <SoundInstallDialogs
        library={library}
        pendingInstall={actions.pendingInstall}
        pendingExistingMod={actions.pendingExistingMod}
        confirmRestore={actions.confirmRestore}
        confirmUninstall={actions.confirmUninstall}
        chooseUninstallAction={actions.chooseUninstallAction}
        uninstallBusy={actions.uninstallBusy}
        busy={actions.busy}
        onConfirm={() => void actions.confirmAction()}
        onConfirmExistingMod={action => void actions.chooseExistingModAction(action)}
        onConfirmUninstall={() => void actions.performUninstall()}
        onRestoreInstead={() => void actions.restoreFromChoice()}
        onUninstallInstead={() => void actions.performUninstall()}
        onClose={actions.closeDialogs}
      />
      {actions.pendingUpdate && (
        <SoundPackageUpdateDialog
          packageInfo={actions.pendingUpdate}
          remoteArchiveName={updateResults[actions.pendingUpdate.id]?.remoteArchiveName}
          onConfirm={() => void actions.confirmPackageUpdate()}
          onClose={actions.closeUpdateDialog}
        />
      )}
    </section>
  )
}
