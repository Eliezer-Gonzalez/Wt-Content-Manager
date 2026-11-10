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
  setSoundDownloadPaused,
  type SoundDownloadProgress,
  type SoundModStatus,
  type SoundPackage,
} from '../lib/sounds'
import type { WtLiveItem } from '../lib/wtLive'

export function useSoundLibrary(gamePath?: string) {
  const { t } = useI18n()
  const [packages, setPackages] = useState<SoundPackage[]>([])
  const [status, setStatus] = useState<SoundModStatus | null>(null)
  const [loading, setLoading] = useState(isTauriRuntime)
  const [statusLoading, setStatusLoading] = useState(Boolean(gamePath))
  const [downloadProgress, setDownloadProgress] = useState<SoundDownloadProgress | null>(null)
  const [downloadingId, setDownloadingId] = useState<number | null>(null)
  const [installingId, setInstallingId] = useState<string | null>(null)
  const [restoring, setRestoring] = useState(false)
  const [paused, setPaused] = useState(false)
  const [error, setError] = useState('')
  const taskIdRef = useRef<string | null>(null)
  const mountedRef = useRef(true)

  const formatError = useCallback((cause: unknown) => {
    const formatted = formatAppError(cause, t)
    return formatted.detail ? `${formatted.message} (${formatted.detail})` : formatted.message
  }, [t])

  const refreshPackages = useCallback(async () => {
    if (!isTauriRuntime) return
    setLoading(true)
    try {
      setPackages(await listSoundPackages())
    } catch (cause) {
      if (mountedRef.current) setError(formatError(cause))
    } finally {
      if (mountedRef.current) setLoading(false)
    }
  }, [formatError])

  const refreshStatus = useCallback(async () => {
    if (!gamePath || !isTauriRuntime) {
      setStatus(null)
      setStatusLoading(false)
      return null
    }
    setStatusLoading(true)
    try {
      const nextStatus = await getSoundModStatus(gamePath)
      if (mountedRef.current) setStatus(nextStatus)
      return nextStatus
    } catch (cause) {
      if (mountedRef.current) {
        setStatus(null)
        setError(formatError(cause))
      }
      return null
    } finally {
      if (mountedRef.current) setStatusLoading(false)
    }
  }, [formatError, gamePath])

  useEffect(() => {
    mountedRef.current = true
    void refreshPackages()
    void refreshStatus()
    return () => {
      mountedRef.current = false
      const taskId = taskIdRef.current
      if (taskId) void cancelSoundDownload(taskId).catch(() => undefined)
    }
  }, [refreshPackages, refreshStatus])

  const download = useCallback(async (item: WtLiveItem) => {
    if (!isTauriRuntime || taskIdRef.current) return
    const taskId = crypto.randomUUID()
    taskIdRef.current = taskId
    setDownloadingId(item.id)
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

  const install = useCallback(async (packageId: string) => {
    if (!gamePath) return
    setInstallingId(packageId)
    setError('')
    try {
      await installSoundPackage(gamePath, packageId)
      await refreshStatus()
    } catch (cause) {
      setError(formatError(cause))
      await refreshStatus()
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

  return {
    packages,
    status,
    loading,
    statusLoading,
    downloadProgress,
    downloadingId,
    installingId,
    restoring,
    paused,
    error,
    download,
    togglePause,
    cancelDownload,
    install,
    restore,
    refreshPackages,
    refreshStatus,
  }
}
