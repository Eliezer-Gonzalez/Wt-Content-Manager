import { useCallback, useEffect, useRef, useState } from 'react'
import { useI18n } from '../i18n/I18nContext'
import { formatAppError } from '../lib/appError'
import { isTauriRuntime } from '../lib/gameInstall'
import {
  cancelSoundDownload,
  downloadSoundPackage,
  getSoundModStatus,
  installSoundPackage,
  listSoundPackages,
  restoreSoundModBackup,
  uninstallSoundMod,
  setSoundDownloadPaused,
  type SoundDownloadProgress,
  type ExistingSoundModAction,
  type SoundModStatus,
  type SoundPackage,
} from '../lib/sounds'
import type { WtLiveItem } from '../lib/wtLive'
import { useSoundPackageUpdateTransfer } from './useSoundPackageUpdateTransfer'
import { useDownloadPauseCancel } from './useDownloadPauseCancel'
import { announceDownloadCompletion } from '../lib/downloadCompletion'

const pauseSoundTask = (taskId: string) => setSoundDownloadPaused(taskId, true)
const resumeSoundTask = (taskId: string) => setSoundDownloadPaused(taskId, false)

export function useSoundLibrary(gamePath?: string, shouldLoadStatus = false) {
  const { t } = useI18n()
  const [packages, setPackages] = useState<SoundPackage[]>([])
  const [packageLoading, setPackageLoading] = useState(isTauriRuntime)
  const [statusSnapshot, setStatusSnapshot] = useState<{ gamePath?: string; value: SoundModStatus | null } | null>(null)
  const [statusRequestLoading, setStatusRequestLoading] = useState(Boolean(gamePath))
  const [downloadProgress, setDownloadProgress] = useState<SoundDownloadProgress | null>(null)
  const [downloadingId, setDownloadingId] = useState<number | null>(null)
  const [downloadingItem, setDownloadingItem] = useState<WtLiveItem | null>(null)
  const [downloadId, setDownloadId] = useState<string | null>(null)
  const [installingId, setInstallingId] = useState<string | null>(null)
  const [restoring, setRestoring] = useState(false)
  const [uninstalling, setUninstalling] = useState(false)
  const [error, setError] = useState('')
  const taskIdRef = useRef<string | null>(null)
  const mountedRef = useRef(true)
  const gamePathRef = useRef(gamePath)
  const statusRequestRef = useRef(0)
  const packageRequestRef = useRef(0)
  gamePathRef.current = gamePath
  const status = statusSnapshot && statusSnapshot.gamePath === gamePath ? statusSnapshot.value : null
  const statusLoading = statusRequestLoading || Boolean(shouldLoadStatus && gamePath && statusSnapshot?.gamePath !== gamePath)

  const formatError = useCallback((cause: unknown) => {
    const formatted = formatAppError(cause, t)
    return formatted.detail ? `${formatted.message} (${formatted.detail})` : formatted.message
  }, [t])
  const reportError = useCallback((cause: unknown) => setError(formatError(cause)), [formatError])

  const {
    paused,
    togglePause,
    confirmCancelDownload: cancelDownload,
    requestCancelDownload: prepareCancelDownload,
    continueAfterCancelPrompt,
    dismissCancelPrompt,
    reset: resetPauseCancel,
  } = useDownloadPauseCancel({
    downloadId,
    downloadIdRef: taskIdRef,
    pauseDownloadTask: pauseSoundTask,
    resumeDownloadTask: resumeSoundTask,
    cancelDownloadTask: cancelSoundDownload,
    onError: reportError,
    cancelOnUnmount: true,
  })

  const refreshPackages = useCallback(async () => {
    if (!isTauriRuntime) return
    const requestId = ++packageRequestRef.current
    setPackageLoading(true)
    try {
      const nextPackages = await listSoundPackages()
      if (mountedRef.current && requestId === packageRequestRef.current) setPackages(nextPackages)
    } catch (cause) {
      if (mountedRef.current && requestId === packageRequestRef.current) setError(formatError(cause))
    } finally {
      if (mountedRef.current && requestId === packageRequestRef.current) setPackageLoading(false)
    }
  }, [formatError])
  const refreshPackagesRef = useRef(refreshPackages)
  refreshPackagesRef.current = refreshPackages
  const updateTransfer = useSoundPackageUpdateTransfer({
    canStart: () => taskIdRef.current === null,
    refreshPackages,
    formatError,
    setError,
  })

  const refreshStatus = useCallback(async () => {
    const requestedPath = gamePath
    if (requestedPath !== gamePathRef.current) return null
    const requestId = ++statusRequestRef.current
    if (!requestedPath || !isTauriRuntime) {
      if (mountedRef.current && requestId === statusRequestRef.current && requestedPath === gamePathRef.current) {
        setStatusSnapshot({ gamePath: requestedPath, value: null })
        setStatusRequestLoading(false)
      }
      return null
    }
    setStatusRequestLoading(true)
    try {
      const nextStatus = await getSoundModStatus(requestedPath)
      if (mountedRef.current && requestId === statusRequestRef.current && requestedPath === gamePathRef.current) {
        setStatusSnapshot({ gamePath: requestedPath, value: nextStatus })
      }
      return nextStatus
    } catch (cause) {
      if (mountedRef.current && requestId === statusRequestRef.current && requestedPath === gamePathRef.current) {
        setStatusSnapshot({ gamePath: requestedPath, value: null })
        setError(formatError(cause))
      }
      return null
    } finally {
      if (mountedRef.current && requestId === statusRequestRef.current && requestedPath === gamePathRef.current) setStatusRequestLoading(false)
    }
  }, [formatError, gamePath])

  useEffect(() => {
    mountedRef.current = true
    void refreshPackagesRef.current()
    return () => {
      mountedRef.current = false
    }
  }, [])

  useEffect(() => {
    // Invalidate any in-flight response for the previous game installation.
    statusRequestRef.current += 1
    if (shouldLoadStatus) void refreshStatus()
  }, [refreshStatus, shouldLoadStatus])

  const download = useCallback(async (item: WtLiveItem) => {
    if (!isTauriRuntime || taskIdRef.current || updateTransfer.busy) return
    const taskId = crypto.randomUUID()
    taskIdRef.current = taskId
    setDownloadId(taskId)
    setDownloadingId(item.id)
    setDownloadingItem(item)
    setDownloadProgress({ phase: 'downloading', downloadedBytes: 0, totalBytes: null, paused: false })
    resetPauseCancel()
    setError('')
    try {
      await downloadSoundPackage(item, taskId, progress => {
        if (mountedRef.current) setDownloadProgress(progress)
      })
      announceDownloadCompletion('sound', item.title || item.fileName || t('soundMod'))
      await refreshPackages()
    } catch (cause) {
      if (mountedRef.current) setError(formatError(cause))
    } finally {
      taskIdRef.current = null
      if (mountedRef.current) {
        setDownloadId(null)
        setDownloadingId(null)
        setDownloadingItem(null)
        setDownloadProgress(null)
        resetPauseCancel()
      }
    }
  }, [formatError, refreshPackages, resetPauseCancel, t, updateTransfer.busy])

  const dismissError = useCallback(() => setError(''), [])

  const install = useCallback(async (packageId: string, existingModAction?: ExistingSoundModAction) => {
    if (!gamePath) return false
    setInstallingId(packageId)
    setError('')
    try {
      await installSoundPackage(gamePath, packageId, existingModAction)
      await refreshStatus()
      return true
    } catch (cause) {
      setError(formatError(cause))
      await refreshStatus()
      return false
    } finally {
      setInstallingId(null)
    }
  }, [formatError, gamePath, refreshStatus])

  const restore = useCallback(async () => {
    if (!gamePath) return
    setRestoring(true)
    setError('')
    try {
      await restoreSoundModBackup(gamePath)
      await refreshStatus()
    } catch (cause) {
      setError(formatError(cause))
      await refreshStatus()
    } finally {
      setRestoring(false)
    }
  }, [formatError, gamePath, refreshStatus])

  const uninstall = useCallback(async () => {
    if (!gamePath) return false
    setUninstalling(true)
    setError('')
    try {
      await uninstallSoundMod(gamePath)
      await refreshStatus()
      return true
    } catch (cause) {
      setError(formatError(cause))
      await refreshStatus()
      return false
    } finally {
      setUninstalling(false)
    }
  }, [formatError, gamePath, refreshStatus])

  return {
    packages,
    status,
    loading: packageLoading,
    statusLoading,
    downloadProgress,
    updatePackageId: updateTransfer.packageId,
    updateProgress: updateTransfer.progress,
    updatePaused: updateTransfer.paused,
    downloadingId,
    downloadingItem,
    installingId,
    restoring,
    uninstalling,
    paused,
    error,
    dismissError,
    download,
    updatePackage: updateTransfer.update,
    toggleUpdatePause: updateTransfer.togglePause,
    cancelUpdate: updateTransfer.cancel,
    prepareCancelUpdate: updateTransfer.prepareCancel,
    continueAfterUpdateCancelPrompt: updateTransfer.continueAfterCancelPrompt,
    dismissUpdateCancelPrompt: updateTransfer.dismissCancelPrompt,
    togglePause,
    cancelDownload,
    prepareCancelDownload,
    continueAfterCancelPrompt,
    dismissCancelPrompt,
    install,
    restore,
    uninstall,
    refreshPackages,
    refreshStatus,
  }
}

export type SoundLibraryController = ReturnType<typeof useSoundLibrary>
