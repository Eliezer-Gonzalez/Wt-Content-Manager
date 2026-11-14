import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'

export type UseDownloadPauseCancelOptions = {
  /** Active download task identifier, or null when no transfer is running. */
  downloadId: string | null
  /** Optional synchronous ref mirror of the active download ID to avoid stale closures across async boundaries. */
  downloadIdRef?: RefObject<string | null>
  /** Enables pause/resume/cancel controls (for example, only while in the downloading phase). */
  canControl?: boolean
  pauseDownloadTask: (downloadId: string) => Promise<void>
  resumeDownloadTask: (downloadId: string) => Promise<void>
  cancelDownloadTask: (downloadId: string) => Promise<void>
  onError?: (cause: unknown) => void
  onCancelStart?: () => void
  onCancelError?: (cause: unknown) => void
  onCancelIdle?: () => Promise<void> | void
  cancelOnUnmount?: boolean
}

/**
 * Shared state machine for download pause/resume and cancel-confirmation prompts.
 */
export function useDownloadPauseCancel({
  downloadId,
  downloadIdRef,
  canControl = true,
  pauseDownloadTask,
  resumeDownloadTask,
  cancelDownloadTask,
  onError,
  onCancelStart,
  onCancelError,
  onCancelIdle,
  cancelOnUnmount = true,
}: UseDownloadPauseCancelOptions) {
  const [paused, setPaused] = useState(false)
  const [confirmingCancel, setConfirmingCancel] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const wasPausedBeforeCancelPromptRef = useRef(false)
  const latestDownloadIdRef = useRef<string | null>(downloadId)
  const cancelDownloadTaskRef = useRef(cancelDownloadTask)
  const onCancelStartRef = useRef(onCancelStart)
  const cancelOnUnmountRef = useRef(cancelOnUnmount)

  useEffect(() => {
    latestDownloadIdRef.current = downloadId
    cancelDownloadTaskRef.current = cancelDownloadTask
    onCancelStartRef.current = onCancelStart
    cancelOnUnmountRef.current = cancelOnUnmount
  })

  const getActiveDownloadId = useCallback(
    () => (downloadIdRef ? downloadIdRef.current : latestDownloadIdRef.current),
    [downloadIdRef],
  )

  useEffect(() => () => {
    if (!cancelOnUnmountRef.current) return
    const activeId = getActiveDownloadId()
    if (!activeId) return
    onCancelStartRef.current?.()
    void cancelDownloadTaskRef.current(activeId).catch(() => undefined)
  }, [getActiveDownloadId])

  const reset = useCallback(() => {
    wasPausedBeforeCancelPromptRef.current = false
    setPaused(false)
    setConfirmingCancel(false)
    setCancelling(false)
  }, [])

  const pauseDownload = useCallback(async () => {
    const activeId = getActiveDownloadId()
    if (!activeId || !canControl) return false
    setPaused(true)
    try {
      await pauseDownloadTask(activeId)
      return true
    } catch (cause) {
      if (getActiveDownloadId() === activeId) setPaused(false)
      onError?.(cause)
      return false
    }
  }, [canControl, getActiveDownloadId, onError, pauseDownloadTask])

  const resumeDownload = useCallback(async () => {
    const activeId = getActiveDownloadId()
    if (!activeId || !canControl) return false
    setPaused(false)
    try {
      await resumeDownloadTask(activeId)
      return true
    } catch (cause) {
      if (getActiveDownloadId() === activeId) setPaused(true)
      onError?.(cause)
      return false
    }
  }, [canControl, getActiveDownloadId, onError, resumeDownloadTask])

  const togglePause = useCallback(async () => {
    if (paused) await resumeDownload()
    else await pauseDownload()
  }, [pauseDownload, paused, resumeDownload])

  const requestCancelDownload = useCallback(async () => {
    const activeId = getActiveDownloadId()
    if (!activeId || !canControl) return false
    wasPausedBeforeCancelPromptRef.current = paused
    if (!paused) {
      try {
        await pauseDownloadTask(activeId)
      } catch (cause) {
        wasPausedBeforeCancelPromptRef.current = false
        if (getActiveDownloadId() !== activeId) return false
        onError?.(cause)
        return false
      }
    }
    if (getActiveDownloadId() !== activeId) return false
    setPaused(true)
    setConfirmingCancel(true)
    return true
  }, [canControl, getActiveDownloadId, onError, pauseDownloadTask, paused])

  const resumeAfterCancelPrompt = useCallback(async (activeId: string) => {
    setPaused(false)
    try {
      await resumeDownloadTask(activeId)
    } catch (cause) {
      if (getActiveDownloadId() === activeId) setPaused(true)
      onError?.(cause)
    }
  }, [getActiveDownloadId, onError, resumeDownloadTask])

  const continueAfterCancelPrompt = useCallback(async () => {
    const activeId = getActiveDownloadId()
    wasPausedBeforeCancelPromptRef.current = false
    setConfirmingCancel(false)
    if (!activeId) return
    await resumeAfterCancelPrompt(activeId)
  }, [getActiveDownloadId, resumeAfterCancelPrompt])

  const dismissCancelPrompt = useCallback(async () => {
    const activeId = getActiveDownloadId()
    const wasPaused = wasPausedBeforeCancelPromptRef.current
    wasPausedBeforeCancelPromptRef.current = false
    setConfirmingCancel(false)
    // Preserve the user's prior pause state if the download was already paused before opening the dialog.
    if (!activeId || wasPaused) return
    await resumeAfterCancelPrompt(activeId)
  }, [getActiveDownloadId, resumeAfterCancelPrompt])

  const confirmCancelDownload = useCallback(async () => {
    setConfirmingCancel(false)
    const activeId = getActiveDownloadId()
    if (!activeId) {
      if (onCancelIdle) {
        try {
          await onCancelIdle()
        } catch (cause) {
          onError?.(cause)
        }
      }
      return
    }
    if (!canControl) return
    onCancelStart?.()
    setCancelling(true)
    try {
      await cancelDownloadTask(activeId)
    } catch (cause) {
      if (getActiveDownloadId() === activeId) setCancelling(false)
      onCancelError?.(cause)
      onError?.(cause)
    }
  }, [canControl, cancelDownloadTask, getActiveDownloadId, onCancelError, onCancelIdle, onCancelStart, onError])

  return {
    paused,
    confirmingCancel,
    cancelling,
    wasPausedBeforeCancelPromptRef,
    setPaused,
    setCancelling,
    pauseDownload,
    resumeDownload,
    togglePause,
    requestCancelDownload,
    continueAfterCancelPrompt,
    dismissCancelPrompt,
    confirmCancelDownload,
    reset,
  }
}
