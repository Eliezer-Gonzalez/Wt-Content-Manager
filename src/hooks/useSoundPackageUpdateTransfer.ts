import { useCallback, useEffect, useRef, useState } from 'react'
import { cancelSoundDownload, setSoundDownloadPaused, updateSoundPackage, type SoundDownloadProgress, type SoundPackage } from '../lib/sounds'
import { announceDownloadCompletion } from '../lib/downloadCompletion'

type Props = {
  canStart: () => boolean
  refreshPackages: () => Promise<void>
  formatError: (cause: unknown) => string
  setError: (message: string) => void
}

export function useSoundPackageUpdateTransfer({ canStart, refreshPackages, formatError, setError }: Props) {
  const [packageId, setPackageId] = useState<string | null>(null)
  const [progress, setProgress] = useState<SoundDownloadProgress | null>(null)
  const [paused, setPaused] = useState(false)
  const taskIdRef = useRef<string | null>(null)
  const wasPausedBeforeCancelPromptRef = useRef(false)
  useEffect(() => () => {
    const taskId = taskIdRef.current
    if (taskId) void cancelSoundDownload(taskId).catch(() => undefined)
  }, [])

  const update = useCallback(async (packageInfo: SoundPackage) => {
    if (taskIdRef.current || !canStart()) return null
    const taskId = crypto.randomUUID()
    taskIdRef.current = taskId
    setPackageId(packageInfo.id)
    setPaused(false)
    setProgress({ phase: 'downloading', downloadedBytes: 0, totalBytes: null, paused: false })
    setError('')
    try {
      const updated = await updateSoundPackage(packageInfo.id, packageInfo.revision, taskId, next => setProgress(next))
      announceDownloadCompletion('sound-update', packageInfo.title || packageInfo.archiveName)
      await refreshPackages()
      return updated
    } catch (cause) {
      setError(formatError(cause))
      return null
    } finally {
      taskIdRef.current = null
      setPackageId(null)
      setProgress(null)
      setPaused(false)
    }
  }, [canStart, formatError, refreshPackages, setError])

  const togglePause = useCallback(async () => {
    const taskId = taskIdRef.current
    if (!taskId || progress?.phase !== 'downloading') return
    const next = !paused
    setPaused(next)
    try {
      await setSoundDownloadPaused(taskId, next)
    } catch (cause) {
      setPaused(!next)
      setError(formatError(cause))
    }
  }, [formatError, paused, progress?.phase, setError])

  const cancel = useCallback(async () => {
    const taskId = taskIdRef.current
    if (!taskId || progress?.phase !== 'downloading') return
    try {
      await cancelSoundDownload(taskId)
    } catch (cause) {
      setError(formatError(cause))
    }
  }, [formatError, progress?.phase, setError])

  const prepareCancel = useCallback(async () => {
    const taskId = taskIdRef.current
    if (!taskId || progress?.phase !== 'downloading') return false
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
  }, [formatError, paused, progress?.phase, setError])

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
  }, [formatError, setError])

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
  }, [formatError, setError])

  return {
    packageId, progress, paused, busy: Boolean(packageId), update, togglePause,
    cancel, prepareCancel, continueAfterCancelPrompt, dismissCancelPrompt,
  }
}
