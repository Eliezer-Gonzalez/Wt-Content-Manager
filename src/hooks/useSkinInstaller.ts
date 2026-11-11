import { useCallback, useEffect, useRef, useState } from 'react'
import { cancelSkinDownload, installSkin, setSkinDownloadPaused, type SkinInstallProgress } from '../lib/skins'
import type { InstalledSkin } from '../lib/localLibrary'
import type { WtLiveItem } from '../lib/wtLive'
import type { TranslateFn } from '../i18n/I18nProvider'
import { formatAppError } from '../lib/appError'

export type SkinInstallWarning = {
  skippedFiles: number
  skippedExecutables: number
  missingTextureCount: number
  missingTextureNames: string[]
}

type Options = {
  gamePath?: string
  selectionKey?: number
  t: TranslateFn
  onInstalled: (item: WtLiveItem, result: Omit<InstalledSkin, 'item' | 'installedAt'>) => void
}

export function useSkinInstaller({ gamePath, selectionKey, t, onInstalled }: Options) {
  const [installing, setInstalling] = useState(false)
  const [progress, setProgress] = useState<SkinInstallProgress | null>(null)
  const [paused, setPaused] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [cancelled, setCancelled] = useState(false)
  const [error, setError] = useState('')
  const [installedPath, setInstalledPath] = useState('')
  const [warning, setWarning] = useState<SkinInstallWarning | null>(null)
  const [activeLangGroup, setActiveLangGroup] = useState<number | null>(null)
  const [resultLangGroup, setResultLangGroup] = useState<number | null>(null)
  const taskIdRef = useRef<string | null>(null)
  const cancelRequestedRef = useRef(false)
  const wasPausedBeforeCancelPromptRef = useRef(false)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      const activeTaskId = taskIdRef.current
      if (activeTaskId) {
        cancelRequestedRef.current = true
        cancelSkinDownload(activeTaskId).catch(() => {
          /* Best effort: the component is already unmounted. */
        })
      }
    }
  }, [])

  const resetInstallState = useCallback(() => {
    setError('')
    setInstalledPath('')
    setWarning(null)
    setCancelled(false)
    setResultLangGroup(null)
  }, [])

  useEffect(() => {
    resetInstallState()
  }, [selectionKey, resetInstallState])

  const install = useCallback(async (item: WtLiveItem, replaceFolderName?: string) => {
    if (!gamePath) return
    if (taskIdRef.current) return
    const taskId = crypto.randomUUID()
    taskIdRef.current = taskId
    setActiveLangGroup(item.langGroup)
    cancelRequestedRef.current = false
    setInstalling(true)
    setProgress({ phase: 'preparing', downloadedBytes: 0, totalBytes: null, paused: false })
    setPaused(false)
    setCancelling(false)
    setCancelled(false)
    setError('')
    setInstalledPath('')
    setWarning(null)
    try {
      const result = await installSkin(item.langGroup, gamePath, taskId, progressUpdate => {
        if (mountedRef.current) setProgress(progressUpdate)
      }, replaceFolderName)
      if (!mountedRef.current) return
      setResultLangGroup(item.langGroup)
      setInstalledPath(result.path)
      if (result.skippedFiles > 0 || result.missingTextureCount > 0) {
        setWarning({
          skippedFiles: result.skippedFiles,
          skippedExecutables: result.skippedExecutables,
          missingTextureCount: result.missingTextureCount,
          missingTextureNames: result.missingTextureNames,
        })
      } else {
        setWarning(null)
      }
      const { missingTextureCount: _missingCount, missingTextureNames: _missingNames, ...installedSkin } = result
      onInstalled(item, installedSkin)
    } catch (cause) {
      if (!mountedRef.current) return
      if (cancelRequestedRef.current) {
        setResultLangGroup(item.langGroup)
        setCancelled(true)
      } else {
        setResultLangGroup(item.langGroup)
        const formatted = formatAppError(cause, t)
        setError(formatted.detail ? `${formatted.message} (${formatted.detail})` : formatted.message)
      }
    } finally {
      taskIdRef.current = null
      if (mountedRef.current) {
        setActiveLangGroup(null)
        setInstalling(false)
        setProgress(null)
        setPaused(false)
        setCancelling(false)
      }
    }
  }, [gamePath, onInstalled, t])

  const togglePause = useCallback(async () => {
    const taskId = taskIdRef.current
    if (!taskId) return
    const nextPaused = !paused
    setPaused(nextPaused)
    try {
      await setSkinDownloadPaused(taskId, nextPaused)
    } catch (cause) {
      setPaused(!nextPaused)
      const formatted = formatAppError(cause, t)
      setError(formatted.detail ? `${formatted.message} (${formatted.detail})` : formatted.message)
    }
  }, [paused, t])

  const prepareCancel = useCallback(async () => {
    const taskId = taskIdRef.current
    if (!taskId) return false
    wasPausedBeforeCancelPromptRef.current = paused
    if (!paused) {
      try {
        await setSkinDownloadPaused(taskId, true)
      } catch (cause) {
        wasPausedBeforeCancelPromptRef.current = false
        if (taskIdRef.current !== taskId) return false
        const formatted = formatAppError(cause, t)
        setError(formatted.detail ? `${formatted.message} (${formatted.detail})` : formatted.message)
        return false
      }
    }
    if (taskIdRef.current !== taskId) return false
    setPaused(true)
    return true
  }, [paused, t])

  const continueAfterCancelPrompt = useCallback(async () => {
    const taskId = taskIdRef.current
    wasPausedBeforeCancelPromptRef.current = false
    if (!taskId) return
    setPaused(false)
    try {
      await setSkinDownloadPaused(taskId, false)
    } catch (cause) {
      setPaused(true)
      const formatted = formatAppError(cause, t)
      setError(formatted.detail ? `${formatted.message} (${formatted.detail})` : formatted.message)
    }
  }, [t])

  const dismissCancelPrompt = useCallback(async () => {
    const taskId = taskIdRef.current
    const wasPaused = wasPausedBeforeCancelPromptRef.current
    wasPausedBeforeCancelPromptRef.current = false
    if (!taskId || wasPaused) return
    setPaused(false)
    try {
      await setSkinDownloadPaused(taskId, false)
    } catch (cause) {
      setPaused(true)
      const formatted = formatAppError(cause, t)
      setError(formatted.detail ? `${formatted.message} (${formatted.detail})` : formatted.message)
    }
  }, [t])

  const cancel = useCallback(async () => {
    const taskId = taskIdRef.current
    if (!taskId) return
    cancelRequestedRef.current = true
    setCancelling(true)
    try {
      await cancelSkinDownload(taskId)
    } catch (cause) {
      cancelRequestedRef.current = false
      setCancelling(false)
      const formatted = formatAppError(cause, t)
      setError(formatted.detail ? `${formatted.message} (${formatted.detail})` : formatted.message)
    }
  }, [t])

  return { installing, progress, paused, cancelling, cancelled, error, installedPath, warning, activeLangGroup, resultLangGroup, install, togglePause, cancel, prepareCancel, continueAfterCancelPrompt, dismissCancelPrompt, resetInstallState }
}

export type SkinInstaller = ReturnType<typeof useSkinInstaller>

