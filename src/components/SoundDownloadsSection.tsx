import { useEffect, useState } from 'react'
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
import { getSoundInstallPreflight, openSoundModFolder, openSoundPackageLibraryFolder, type ExistingSoundModAction } from '../lib/sounds'
import { waitForMinimumLoadingDuration } from '../lib/minimumLoadingDuration'
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
  const { t, locale } = useI18n()
  const [pendingInstall, setPendingInstall] = useState<SoundPackage | null>(null)
  const [pendingExistingMod, setPendingExistingMod] = useState<SoundPackage | null>(null)
  const [pendingUpdate, setPendingUpdate] = useState<SoundPackage | null>(null)
  const [confirmRestore, setConfirmRestore] = useState(false)
  const [confirmUninstall, setConfirmUninstall] = useState(false)
  const [chooseUninstallAction, setChooseUninstallAction] = useState(false)
  const [uninstallFeedbackBusy, setUninstallFeedbackBusy] = useState(false)
  const [uninstallSuccess, setUninstallSuccess] = useState(false)
  const [openingModFolder, setOpeningModFolder] = useState(false)
  const [modFolderError, setModFolderError] = useState(false)
  const [openingPackagesFolder, setOpeningPackagesFolder] = useState(false)
  const [packagesFolderError, setPackagesFolderError] = useState(false)
  const [scanningPackages, setScanningPackages] = useState(false)
  const [checkingStatus, setCheckingStatus] = useState(false)
  const [checkingInstallStatus, setCheckingInstallStatus] = useState(false)
  const [installStatusWarning, setInstallStatusWarning] = useState<'running' | 'unknown' | null>(null)
  const activePackage = library.packages.find(packageInfo => packageInfo.id === library.status?.activePackageId)
  const gameReady = Boolean(gamePath && !library.statusLoading && !checkingInstallStatus && library.status?.processStatus === 'stopped')
  const uninstallBusy = library.uninstalling || uninstallFeedbackBusy
  const busy = Boolean(library.installingId || library.restoring || uninstallBusy || library.updatePackageId || library.downloadingId !== null)
  const totalSizeBytes = library.packages.reduce((total, packageInfo) => total + packageInfo.sizeBytes, 0)
  const isCheckingStatus = checkingStatus || library.statusLoading

  useEffect(() => {
    if (!uninstallSuccess) return
    const timer = window.setTimeout(() => setUninstallSuccess(false), 4000)
    return () => window.clearTimeout(timer)
  }, [uninstallSuccess])

  async function confirmAction() {
    if (pendingInstall) {
      await library.install(pendingInstall.id)
      setPendingInstall(null)
    } else if (confirmRestore) {
      await library.restore()
      setConfirmRestore(false)
    }
  }

  function requestUninstall() {
    if (library.status?.originalBackupAvailable) setChooseUninstallAction(true)
    else setConfirmUninstall(true)
  }

  async function performUninstall() {
    const startedAt = Date.now()
    setUninstallFeedbackBusy(true)
    try {
      const [success] = await Promise.all([
        library.uninstall(),
        waitForMinimumLoadingDuration(startedAt, 500),
      ])
      setConfirmUninstall(false)
      setChooseUninstallAction(false)
      setUninstallSuccess(success)
    } finally {
      setUninstallFeedbackBusy(false)
    }
  }

  async function performRestoreFromChoice() {
    await library.restore()
    setChooseUninstallAction(false)
  }

  async function confirmExistingModAction(action: ExistingSoundModAction) {
    if (!pendingExistingMod) return
    await library.install(pendingExistingMod.id, action)
    setPendingExistingMod(null)
  }

  async function confirmPackageUpdate() {
    if (!pendingUpdate) return
    const packageInfo = pendingUpdate
    setPendingUpdate(null)
    const updated = await library.updatePackage(packageInfo)
    if (updated) onMarkUpdated(updated.id, updated.revision, updated.archiveName)
  }

  async function handleRequestInstall(packageInfo: SoundPackage) {
    if (!gamePath || checkingInstallStatus || busy) return
    setCheckingInstallStatus(true)
    setInstallStatusWarning(null)
    try {
      const freshStatus = await library.refreshStatus()
      if (freshStatus?.processStatus !== 'stopped') {
        setInstallStatusWarning(freshStatus?.processStatus === 'running' ? 'running' : 'unknown')
        return
      }
      const preflight = await getSoundInstallPreflight(gamePath)
      if (preflight.existingContent) setPendingExistingMod(packageInfo)
      else setPendingInstall(packageInfo)
    } catch {
      setInstallStatusWarning('unknown')
    } finally {
      setCheckingInstallStatus(false)
    }
  }

  async function handleOpenModFolder() {
    if (!gamePath || openingModFolder) return
    setOpeningModFolder(true)
    setModFolderError(false)
    try {
      await openSoundModFolder(gamePath)
    } catch {
      setModFolderError(true)
    } finally {
      setOpeningModFolder(false)
    }
  }

  async function handleOpenPackagesFolder() {
    if (openingPackagesFolder) return
    setOpeningPackagesFolder(true)
    setPackagesFolderError(false)
    try {
      await openSoundPackageLibraryFolder()
    } catch {
      setPackagesFolderError(true)
    } finally {
      setOpeningPackagesFolder(false)
    }
  }

  async function handleRescanPackages() {
    if (library.loading || scanningPackages) return
    const startedAt = Date.now()
    setScanningPackages(true)
    try {
      await library.refreshPackages()
    } finally {
      await waitForMinimumLoadingDuration(startedAt)
      setScanningPackages(false)
    }
  }

  async function handleRefreshStatus() {
    if (isCheckingStatus) return
    setCheckingStatus(true)
    setInstallStatusWarning(null)
    try {
      await Promise.all([
        library.refreshStatus(),
        new Promise<void>(resolve => window.setTimeout(resolve, 500)),
      ])
    } finally {
      setCheckingStatus(false)
    }
  }

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
        checkingStatus={checkingStatus}
        installWarning={installStatusWarning}
        openingModFolder={openingModFolder}
        modFolderError={modFolderError}
        busy={busy}
        onRefreshStatus={() => void handleRefreshStatus()}
        onOpenModFolder={() => void handleOpenModFolder()}
        onChooseGame={onChooseGame}
      />
      <p className="mb-3 text-xs leading-5 text-[#9fa89b]">
        {t('soundPackageDeleteWarningPrefix')} <strong className="font-medium text-[#d3e2ad]">{t('soundPackageDeleteWarningHighlight')}</strong> {t('soundPackageDeleteWarningSuffix')}
      </p>
      {packagesFolderError && <p className="mb-3 text-xs text-amber-200" role="alert">{t('soundPackageFolderOpenFailed')}</p>}

      {library.status?.backupAvailable && library.status.originalBackupAvailable && !activePackage && (
        <div className="mb-4 flex flex-wrap items-center gap-3 border border-[#41483d] bg-[#1d231d] px-3 py-3 text-sm text-[#c0c5bb]">
          <span className="min-w-0 flex-1">{t('soundBackupAvailable')}</span>
          <Button size="sm" variant="secondary" disabled={!gameReady || busy} onClick={() => setConfirmRestore(true)}>{t('soundRestore')}</Button>
        </div>
      )}
      {activePackage && !packages.some(packageInfo => packageInfo.id === activePackage.id) && (
        <div className="mb-4 flex flex-wrap items-center gap-3 border border-[#586b41] bg-[#202a1d] px-3 py-2 text-xs text-[#c4d79d]">
          <span className="min-w-0 flex-1">{t('soundActivePackageFiltered')}</span>
          <Button size="sm" variant="secondary" disabled={!gameReady || busy} onClick={requestUninstall}>{t('soundUninstall')}</Button>
        </div>
      )}
      {library.status?.activePackageId && !activePackage && (
        <div className="mb-4 flex flex-wrap items-center gap-3 border border-[#586b41] bg-[#202a1d] px-3 py-3 text-sm text-[#c4d79d]">
          <span className="min-w-0 flex-1">{t('soundActivePackageMissing')}</span>
          <Button size="sm" variant="danger" disabled={!gameReady || busy} onClick={requestUninstall}>{t('soundUninstall')}</Button>
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <DownloadsLibrarySummary totalCount={library.packages.length} totalSizeBytes={totalSizeBytes} kind="sounds" />
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-[#9fa89b]">{t('downloadsFilteredCount', { count: packages.length })}</span>
          <Button size="sm" variant="secondary" className="min-h-10" onClick={() => void handleOpenPackagesFolder()} disabled={openingPackagesFolder}>
            {openingPackagesFolder ? <LoaderCircle size={13} className="animate-spin motion-reduce:animate-none" aria-hidden="true" /> : <FolderOpen size={13} aria-hidden="true" />}
            {t(openingPackagesFolder ? 'soundPackageFolderOpening' : 'soundPackageFolderOpen')}
          </Button>
          <AppTooltip align="end" content={t(scanningPackages || library.loading ? 'scanningSoundPackages' : 'rescanSoundPackages')}>
            <Button
              size="md"
              variant="secondary"
              className="size-10 min-w-10 !min-h-10 !px-0 !py-0"
              onClick={() => void handleRescanPackages()}
              disabled={library.loading || scanningPackages}
              aria-label={t('rescanSoundPackages')}
              aria-busy={scanningPackages || library.loading}
            >
              <RefreshCw size={15} className={scanningPackages || library.loading ? 'animate-spin motion-reduce:animate-none' : ''} aria-hidden="true" />
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
      {uninstallSuccess && (
        <div className="mb-4 flex items-center justify-between gap-3 border border-[#586b41] bg-[#202a1d] px-3 py-2.5 text-sm text-[#d3e2ad]" role="status" aria-live="polite">
          <p className="mb-0">{t('soundUninstallSuccess')}</p>
          <Button variant="icon" size="sm" className="shrink-0" onClick={() => setUninstallSuccess(false)} aria-label={t('close')}>
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
              gameReady={gameReady}
              checkingStatus={checkingInstallStatus}
              busy={busy || checkingInstallStatus}
              onInstall={packageInfo => void handleRequestInstall(packageInfo)}
              onUninstall={requestUninstall}
              onOpenPost={onOpenPost}
              onRequestUpdate={setPendingUpdate}
            />
          )}
        />
      )}

      <SoundInstallDialogs
        library={library}
        pendingInstall={pendingInstall}
        pendingExistingMod={pendingExistingMod}
        confirmRestore={confirmRestore}
        confirmUninstall={confirmUninstall}
        chooseUninstallAction={chooseUninstallAction}
        uninstallBusy={uninstallBusy}
        busy={busy}
        onConfirm={() => void confirmAction()}
        onConfirmExistingMod={action => void confirmExistingModAction(action)}
        onConfirmUninstall={() => void performUninstall()}
        onRestoreInstead={() => void performRestoreFromChoice()}
        onUninstallInstead={() => void performUninstall()}
        onClose={() => { setPendingInstall(null); setPendingExistingMod(null); setConfirmRestore(false); setConfirmUninstall(false); setChooseUninstallAction(false) }}
      />
      {pendingUpdate && (
        <SoundPackageUpdateDialog
          packageInfo={pendingUpdate}
          remoteArchiveName={updateResults[pendingUpdate.id]?.remoteArchiveName}
          onConfirm={() => void confirmPackageUpdate()}
          onClose={() => setPendingUpdate(null)}
        />
      )}
    </section>
  )
}
