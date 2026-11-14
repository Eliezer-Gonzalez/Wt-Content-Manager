import { useEffect, useState } from 'react'
import { waitForMinimumLoadingDuration } from '../lib/minimumLoadingDuration'
import {
  getSoundInstallPreflight,
  openSoundModFolder,
  openSoundPackageLibraryFolder,
  type ExistingSoundModAction,
  type SoundPackage,
} from '../lib/sounds'
import type { SoundLibraryController } from './useSoundLibrary'

type Options = {
  gamePath?: string
  library: SoundLibraryController
  onMarkUpdated: (packageId: string, revision: number, archiveName: string) => void
}

export function useSoundDownloadsActions({ gamePath, library, onMarkUpdated }: Options) {
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

  async function restoreFromChoice() {
    await library.restore()
    setChooseUninstallAction(false)
  }

  async function chooseExistingModAction(action: ExistingSoundModAction) {
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

  async function requestInstall(packageInfo: SoundPackage) {
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

  async function openModFolder() {
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

  async function openPackagesFolder() {
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

  async function scanPackages() {
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

  async function refreshStatus() {
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

  function closeDialogs() {
    setPendingInstall(null)
    setPendingExistingMod(null)
    setConfirmRestore(false)
    setConfirmUninstall(false)
    setChooseUninstallAction(false)
  }

  return {
    pendingInstall,
    pendingExistingMod,
    pendingUpdate,
    confirmRestore,
    confirmUninstall,
    chooseUninstallAction,
    uninstallSuccess,
    openingModFolder,
    modFolderError,
    openingPackagesFolder,
    packagesFolderError,
    scanningPackages,
    checkingStatus,
    checkingInstallStatus,
    installStatusWarning,
    activePackage,
    gameReady,
    uninstallBusy,
    busy,
    totalSizeBytes,
    isCheckingStatus,
    confirmAction,
    requestUninstall,
    performUninstall,
    restoreFromChoice,
    chooseExistingModAction,
    confirmPackageUpdate,
    requestInstall,
    openModFolder,
    openPackagesFolder,
    scanPackages,
    refreshStatus,
    requestRestore: () => setConfirmRestore(true),
    requestUpdate: (packageInfo: SoundPackage) => setPendingUpdate(packageInfo),
    dismissUninstallSuccess: () => setUninstallSuccess(false),
    closeUpdateDialog: () => setPendingUpdate(null),
    closeDialogs,
  }
}
