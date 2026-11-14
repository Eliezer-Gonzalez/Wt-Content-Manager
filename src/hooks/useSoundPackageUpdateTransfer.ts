import { useCallback, useRef, useState } from 'react'
import { cancelSoundDownload, setSoundDownloadPaused, updateSoundPackage, type SoundDownloadProgress, type SoundPackage } from '../lib/sounds'
import { announceDownloadCompletion } from '../lib/downloadCompletion'
import { useDownloadPauseCancel } from './useDownloadPauseCancel'

type Props = {
  canStart: () => boolean
  refreshPackages: () => Promise<void>
  formatError: (cause: unknown) => string
  setError: (message: string) => void
}

const pauseSoundTask = (taskId: string) => setSoundDownloadPaused(taskId, true)
const resumeSoundTask = (taskId: string) => setSoundDownloadPaused(taskId, false)

export function useSoundPackageUpdateTransfer({ canStart, refreshPackages, formatError, setError }: Props) {
  const [packageId, setPackageId] = useState<string | null>(null)
  const [downloadId, setDownloadId] = useState<string | null>(null)
  const [progress, setProgress] = useState<SoundDownloadProgress | null>(null)
  const taskIdRef = useRef<string | null>(null)
  const reportError = useCallback((cause: unknown) => setError(formatError(cause)), [formatError, setError])

  const {
    paused,
    togglePause,
    confirmCancelDownload: cancel,
    requestCancelDownload: prepareCancel,
    continueAfterCancelPrompt,
    dismissCancelPrompt,
    reset: resetPauseCancel,
  } = useDownloadPauseCancel({
    downloadId,
    downloadIdRef: taskIdRef,
    canControl: progress?.phase === 'downloading',
    pauseDownloadTask: pauseSoundTask,
    resumeDownloadTask: resumeSoundTask,
    cancelDownloadTask: cancelSoundDownload,
    onError: reportError,
    cancelOnUnmount: true,
  })

  const update = useCallback(async (packageInfo: SoundPackage) => {
    if (taskIdRef.current || !canStart()) return null
    const taskId = crypto.randomUUID()
    taskIdRef.current = taskId
    setDownloadId(taskId)
    setPackageId(packageInfo.id)
    resetPauseCancel()
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
      setDownloadId(null)
      setPackageId(null)
      setProgress(null)
      resetPauseCancel()
    }
  }, [canStart, formatError, refreshPackages, resetPauseCancel, setError])

  return {
    packageId, progress, paused, busy: Boolean(packageId), update, togglePause,
    cancel, prepareCancel, continueAfterCancelPrompt, dismissCancelPrompt,
  }
}
