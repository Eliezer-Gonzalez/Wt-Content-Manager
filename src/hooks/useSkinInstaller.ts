import { useCallback, useEffect, useRef, useState } from 'react'
import { cancelPreparedSkinInstall, cancelSkinDownload, installSkin, resolvePreparedSkinInstall, setSkinDownloadPaused, type DuplicateSkinCandidate, type SkinInstallProgress, type SkinInstallResult } from '../lib/skins'
import type { InstalledSkin } from '../lib/localLibrary'
import type { WtLiveItem } from '../lib/wtLive'
import { announceDownloadCompletion } from '../lib/downloadCompletion'
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
  externalFolderNames: string[]
  onLinkedExternal: (item: WtLiveItem, folderName: string, path: string) => void
}

export function useSkinInstaller({ gamePath, selectionKey, t, onInstalled, externalFolderNames, onLinkedExternal }: Options) {
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
  const [duplicatePrompt, setDuplicatePrompt] = useState<{ pendingId: string; item: WtLiveItem; candidates: DuplicateSkinCandidate[] } | null>(null)
  const [resolvingDuplicate, setResolvingDuplicate] = useState(false)
  const taskIdRef = useRef<string | null>(null)
  const pendingInstallRef = useRef<string | null>(null)
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
      const pendingId = pendingInstallRef.current
      if (pendingId) cancelPreparedSkinInstall(pendingId).catch(() => {})
    }
  }, [])

  const resetInstallState = useCallback(() => {
    const pendingId = pendingInstallRef.current
    pendingInstallRef.current = null
    if (pendingId) cancelPreparedSkinInstall(pendingId).catch(() => {})
    setDuplicatePrompt(null)
    setResolvingDuplicate(false)
    setError('')
    setInstalledPath('')
    setWarning(null)
    setCancelled(false)
    setResultLangGroup(null)
  }, [])

  useEffect(() => {
    resetInstallState()
  }, [selectionKey, resetInstallState])

  useEffect(() => {
    const activeTaskId = taskIdRef.current
    if (activeTaskId) {
      cancelRequestedRef.current = true
      cancelSkinDownload(activeTaskId).catch(() => { cancelRequestedRef.current = false })
    }
    resetInstallState()
  }, [gamePath, resetInstallState])

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
      const outcome = await installSkin(item.langGroup, gamePath, taskId, progressUpdate => {
        if (mountedRef.current) setProgress(progressUpdate)
      }, replaceFolderName, externalFolderNames)
      if (!mountedRef.current) return
      setResultLangGroup(item.langGroup)
      if (outcome.status === 'duplicateFound') {
        pendingInstallRef.current = outcome.pendingId
        setDuplicatePrompt({ pendingId: outcome.pendingId, item, candidates: outcome.candidates })
      } else if (outcome.status === 'installed') {
        applyInstallResult(item, outcome.result)
      } else if (outcome.status === 'linkedExisting') {
        onLinkedExternal(item, outcome.folderName, outcome.path)
        setInstalledPath(outcome.path)
      } else {
        setCancelled(true)
      }
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
  }, [externalFolderNames, gamePath, onInstalled, onLinkedExternal, t])

  function applyInstallResult(item: WtLiveItem, result: SkinInstallResult) {
    announceDownloadCompletion('camouflage', item.title || item.fileName || t('camouflage'))
    setInstalledPath(result.path)
    setWarning(result.skippedFiles > 0 || result.missingTextureCount > 0 ? {
      skippedFiles: result.skippedFiles,
      skippedExecutables: result.skippedExecutables,
      missingTextureCount: result.missingTextureCount,
      missingTextureNames: result.missingTextureNames,
    } : null)
    const { missingTextureCount: _missingCount, missingTextureNames: _missingNames, ...installedSkin } = result
    onInstalled(item, installedSkin)
  }

  const resolveDuplicate = useCallback(async (action: 'install_copy' | 'link_existing' | 'replace_existing' | 'cancel', folderName?: string) => {
    const duplicate = duplicatePrompt
    if (!duplicate || resolvingDuplicate) return
    setResolvingDuplicate(true)
    setError('')
    try {
      const outcome = await resolvePreparedSkinInstall(duplicate.pendingId, action, folderName)
      pendingInstallRef.current = null
      setDuplicatePrompt(null)
      if (outcome.status === 'installed') applyInstallResult(duplicate.item, outcome.result)
      else if (outcome.status === 'linkedExisting') {
        onLinkedExternal(duplicate.item, outcome.folderName, outcome.path)
        setInstalledPath(outcome.path)
      } else setCancelled(true)
    } catch (cause) {
      const pendingExpired = (typeof cause === 'object' && cause !== null && 'code' in cause
        && cause.code === 'skin_pending_install_not_found')
        || String(cause).includes('skin_pending_install_not_found')
        || (cause instanceof Error && cause.message.includes('skin_pending_install_not_found'))
      const staleFolder = typeof cause === 'object' && cause !== null && 'code' in cause && cause.code === 'skin_duplicate_changed'
        || String(cause).includes('skin_duplicate_changed')
      if ((action !== 'link_existing' && !(action === 'replace_existing' && staleFolder)) || pendingExpired) {
        pendingInstallRef.current = null
        setDuplicatePrompt(null)
      }
      const formatted = formatAppError(cause, t)
      setError(formatted.detail ? `${formatted.message} (${formatted.detail})` : formatted.message)
    } finally {
      setResolvingDuplicate(false)
    }
  }, [duplicatePrompt, onInstalled, onLinkedExternal, resolvingDuplicate, t])

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
  }, [paused, progress?.phase, t])

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
  }, [progress?.phase, t])

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
  }, [progress?.phase, t])

  const cancel = useCallback(async () => {
    const taskId = taskIdRef.current
    if (!taskId) {
      const pendingId = pendingInstallRef.current
      if (!pendingId) return
      try {
        await cancelPreparedSkinInstall(pendingId)
        pendingInstallRef.current = null
        setDuplicatePrompt(null)
        setCancelled(true)
      } catch (cause) {
        const formatted = formatAppError(cause, t)
        setError(formatted.detail ? `${formatted.message} (${formatted.detail})` : formatted.message)
      }
      return
    }
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

  return { installing, progress, paused, cancelling, cancelled, error, installedPath, warning, activeLangGroup, resultLangGroup, duplicatePrompt, resolvingDuplicate, resolveDuplicate, install, togglePause, cancel, prepareCancel, continueAfterCancelPrompt, dismissCancelPrompt, resetInstallState }
}

export type SkinInstaller = ReturnType<typeof useSkinInstaller>

