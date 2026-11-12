import { useCallback, useEffect, useRef, useState } from 'react'
import { useI18n } from '../i18n/I18nProvider'
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

export function useSoundLibrary(gamePath?: string, shouldLoadStatus = false) {
  const { t } = useI18n()
  const [packages, setPackages] = useState<SoundPackage[]>([])
  const [packageLoading, setPackageLoading] = useState(isTauriRuntime)
  const [statusSnapshot, setStatusSnapshot] = useState<{ gamePath?: string; value: SoundModStatus | null } | null>(null)
  const [statusRequestLoading, setStatusRequestLoading] = useState(Boolean(gamePath))
  const [downloadProgress, setDownloadProgress] = useState<SoundDownloadProgress | null>(null)
  const [downloadingId, setDownloadingId] = useState<number | null>(null)
  const [downloadingItem, setDownloadingItem] = useState<WtLiveItem | null>(null)
  const [installingId, setInstallingId] = useState<string | null>(null)
  const [restoring, setRestoring] = useState(false)
  const [uninstalling, setUninstalling] = useState(false)
  const [paused, setPaused] = useState(false)
  const [error, setError] = useState('')
  const taskIdRef = useRef<string | null>(null)
  const wasPausedBeforeCancelPromptRef = useRef(false)
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
      const taskId = taskIdRef.current
      if (taskId) void cancelSoundDownload(taskId).catch(() => undefined)
    }
  }, [])

  useEffect(() => {
    // Invalidate any in-flight response for the previous game installation.
    statusRequestRef.current += 1
    if (shouldLoadStatus) void refreshStatus()
  }, [refreshStatus, shouldLoadStatus])

  const download = useCallback(async (item: WtLiveItem) => {
    if (!isTauriRuntime || taskIdRef.current) return
    const taskId = crypto.randomUUID()
    taskIdRef.current = taskId
    setDownloadingId(item.id)
    setDownloadingItem(item)
    setDownloadProgress({ phase: 'downloading', downloadedBytes: 0, totalBytes: null, paused: false })
    setPaused(false)
    setError('')
    try {
      await downloadSoundPackage(item, taskId, progress => {
        if (mountedRef.current) setDownloadProgress(progress)
      })
      await refreshPackages()
    } catch (cause) {
      if (mountedRef.current) setError(formatError(cause))
    } finally {
      taskIdRef.current = null
      if (mountedRef.current) {
        setDownloadingId(null)
        setDownloadingItem(null)
        setDownloadProgress(null)
        setPaused(false)
      }
    }
  }, [formatError, refreshPackages])

  const togglePause = useCallback(async () => {
    const taskId = taskIdRef.current
    if (!taskId) return
    const next = !paused
    setPaused(next)
    try {
      await setSoundDownloadPaused(taskId, next)
    } catch (cause) {
      setPaused(!next)
      setError(formatError(cause))
    }
  }, [formatError, paused])

  const cancelDownload = useCallback(async () => {
    const taskId = taskIdRef.current
    if (!taskId) return
    try {
      await cancelSoundDownload(taskId)
    } catch (cause) {
      setError(formatError(cause))
    }
  }, [formatError])

  const prepareCancelDownload = useCallback(async () => {
    const taskId = taskIdRef.current
    if (!taskId) return false
    wasPausedBeforeCancelPromptRef.current = paused
    if (!paused) {
      try {
        await setSoundDownloadPaused(taskId, true)
      } catch (cause) {
        wasPausedBeforeCancelPromptRef.current = false
        if (taskIdRef.current !== taskId) return false
        setError(formatError(cause))
        return false
      }
    }
    if (taskIdRef.current !== taskId) return false
    setPaused(true)
    return true
  }, [formatError, paused])

  const continueAfterCancelPrompt = useCallback(async () => {
    const taskId = taskIdRef.current
    wasPausedBeforeCancelPromptRef.current = false
    if (!taskId) return
    setPaused(false)
    try {
      await setSoundDownloadPaused(taskId, false)
    } catch (cause) {
      setPaused(true)
      setError(formatError(cause))
    }
  }, [formatError])

  const dismissCancelPrompt = useCallback(async () => {
    const taskId = taskIdRef.current
    const wasPaused = wasPausedBeforeCancelPromptRef.current
    wasPausedBeforeCancelPromptRef.current = false
    if (!taskId || wasPaused) return
    setPaused(false)
    try {
      await setSoundDownloadPaused(taskId, false)
    } catch (cause) {
      setPaused(true)
      setError(formatError(cause))
    }
  }, [formatError])

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
    downloadingId,
    downloadingItem,
    installingId,
    restoring,
    uninstalling,
    paused,
    error,
    dismissError,
    download,
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
