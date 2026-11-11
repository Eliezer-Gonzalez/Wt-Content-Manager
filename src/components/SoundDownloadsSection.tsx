import { useState } from 'react'
import { FolderOpen, HardDrive, LoaderCircle, RefreshCw, X } from 'lucide-react'
import { Button } from './ui/Button'
import { SoundInstallDialogs } from './SoundInstallDialogs'
import { SoundPackageCard } from './SoundPackageCard'
import { SoundPackageDownloadActions } from './SoundPackageDownloadActions'
import { DownloadsLibrarySummary } from './DownloadsLibraryControls'
import { PaginatedGrid } from './PaginatedGrid'
import { AppTooltip } from './ui/AppTooltip'
import { useI18n } from '../i18n/I18nProvider'
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
}

export function SoundDownloadsSection({
  gamePath, library, packages, hasPackages, updateResults, onChooseGame, onExploreSounds, onOpenPost,
}: Props) {
  const { t, locale } = useI18n()
  const [pendingInstall, setPendingInstall] = useState<SoundPackage | null>(null)
  const [pendingExistingMod, setPendingExistingMod] = useState<SoundPackage | null>(null)
  const [confirmRestore, setConfirmRestore] = useState(false)
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
  const busy = Boolean(library.installingId || library.restoring)
  const totalSizeBytes = library.packages.reduce((total, packageInfo) => total + packageInfo.sizeBytes, 0)
  const isCheckingStatus = checkingStatus || library.statusLoading
  const gameStatusKey = isCheckingStatus
    ? 'checkingSoundStatus'
    : library.status?.processStatus === 'running'
      ? 'soundProcessRunning'
      : library.status?.processStatus === 'stopped'
        ? 'soundProcessStopped'
        : 'soundProcessUnknown'
  const gameStatusTone = isCheckingStatus
    ? 'text-[#e6d39d]'
    : library.status?.processStatus === 'running'
      ? 'text-[#f0b6a1]'
      : library.status?.processStatus === 'stopped'
        ? 'text-[#d3e2ad]'
        : 'text-[#d4cba9]'

  async function confirmAction() {
    if (pendingInstall) {
      await library.install(pendingInstall.id)
      setPendingInstall(null)
    } else if (confirmRestore) {
      await library.restore()
      setConfirmRestore(false)
    }
  }

  async function confirmExistingModAction(action: ExistingSoundModAction) {
    if (!pendingExistingMod) return
    await library.install(pendingExistingMod.id, action)
    setPendingExistingMod(null)
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
      {installStatusWarning && (
        <p className="mb-4 border border-[#766638] bg-[#302b1d] px-3 py-2.5 text-sm leading-5 text-[#dfd5b6]" role="alert">
          <strong className="font-semibold text-[#f1e6c5]">{t('soundGameName')}</strong>{' '}
          {t(installStatusWarning === 'running' ? 'soundInstallBlockedRunning' : 'soundInstallStatusUnknown')}
        </p>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-2 border border-[#343b32] bg-[#1d231d] px-3 py-3 text-xs text-[#bac2b0]">
        {gamePath ? (
          <>
            <span role="status" aria-live="polite" aria-busy={isCheckingStatus} className={`inline-flex items-center gap-2 text-sm font-semibold ${gameStatusTone}`}>
              <HardDrive size={15} aria-hidden="true" />
              <span>{t('soundGameStatus')}:</span>
              <strong>{t(gameStatusKey)}</strong>
            </span>
            <span className="text-[#798473]">·</span>
            <span>{t('soundInstalledBanks', { count: library.status?.installedBanks ?? 0 })}</span>
            <Button size="sm" variant="quiet" className="ml-auto" onClick={() => void handleRefreshStatus()} disabled={isCheckingStatus}>
              <RefreshCw size={14} className={isCheckingStatus ? 'animate-spin motion-reduce:animate-none' : ''} aria-hidden="true" />
              {t(isCheckingStatus ? 'checkingSoundStatus' : 'refreshSoundStatus')}
            </Button>
            <Button size="sm" variant="secondary" onClick={() => void handleOpenModFolder()} disabled={openingModFolder || busy}>
              {openingModFolder ? <LoaderCircle size={14} className="animate-spin motion-reduce:animate-none" aria-hidden="true" /> : <FolderOpen size={14} aria-hidden="true" />}
              {t(openingModFolder ? 'openSoundModFolderWorking' : 'openSoundModFolder')}
            </Button>
          </>
        ) : (
          <>
            <span>{t('soundChooseGame')}</span>
            <Button size="sm" variant="secondary" className="ml-auto" onClick={onChooseGame}>{t('chooseGame')}</Button>
          </>
        )}
      </div>
      {modFolderError && <p className="mb-4 text-xs text-amber-200" role="alert">{t('openSoundModFolderFailed')}</p>}
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
          <Button size="sm" variant="secondary" disabled={!gameReady || busy} onClick={() => setConfirmRestore(true)}>{t(library.status?.originalBackupAvailable ? 'soundRestore' : 'soundUninstall')}</Button>
        </div>
      )}
      {library.status?.activePackageId && !activePackage && (
        <div className="mb-4 flex flex-wrap items-center gap-3 border border-[#586b41] bg-[#202a1d] px-3 py-3 text-sm text-[#c4d79d]">
          <span className="min-w-0 flex-1">{t('soundActivePackageMissing')}</span>
          <Button size="sm" variant="danger" disabled={!gameReady || busy} onClick={() => setConfirmRestore(true)}>{t(library.status.originalBackupAvailable ? 'soundRestore' : 'soundUninstall')}</Button>
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
      {library.error && (
        <div className="mb-4 flex items-start justify-between gap-3 border border-[#766638] bg-[#302b1d] px-3 py-2.5 text-sm text-amber-100" role="alert">
          <p className="mb-0 min-w-0">{library.error}</p>
          <Button variant="icon" size="sm" className="-mr-1 -mt-1 shrink-0" onClick={library.dismissError} aria-label={t('close')}>
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
              updateStatus={updateResults[packageInfo.id]}
              gameReady={gameReady}
              checkingStatus={checkingInstallStatus}
              busy={busy || checkingInstallStatus}
              onInstall={packageInfo => void handleRequestInstall(packageInfo)}
              onRestore={() => setConfirmRestore(true)}
              onOpenPost={onOpenPost}
            />
          )}
        />
      )}

      <SoundInstallDialogs
        library={library}
        pendingInstall={pendingInstall}
        pendingExistingMod={pendingExistingMod}
        confirmRestore={confirmRestore}
        busy={busy}
        onConfirm={() => void confirmAction()}
        onConfirmExistingMod={action => void confirmExistingModAction(action)}
        onClose={() => { setPendingInstall(null); setPendingExistingMod(null); setConfirmRestore(false) }}
      />
    </section>
  )
}
