import { useCallback, useEffect, useRef, useState } from 'react'
import { cancelPreparedSkinInstall, cancelSkinDownload, installSkin, resolvePreparedSkinInstall, setSkinDownloadPaused, type DuplicateSkinCandidate, type SkinInstallProgress, type SkinInstallResult } from '../lib/skins'
import type { InstalledSkin } from '../lib/localLibrary'
import type { WtLiveItem } from '../lib/wtLive'
import { announceDownloadCompletion } from '../lib/downloadCompletion'
import type { TranslateFn } from '../i18n/I18nProvider'
import { formatAppError } from '../lib/appError'
import { useDownloadPauseCancel } from './useDownloadPauseCancel'

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

const pauseSkinTask = (taskId: string) => setSkinDownloadPaused(taskId, true)
const resumeSkinTask = (taskId: string) => setSkinDownloadPaused(taskId, false)

export function useSkinInstaller({ gamePath, selectionKey, t, onInstalled, externalFolderNames, onLinkedExternal }: Options) {
  const [installing, setInstalling] = useState(false)
  const [progress, setProgress] = useState<SkinInstallProgress | null>(null)
  const [downloadId, setDownloadId] = useState<string | null>(null)
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
  const mountedRef = useRef(true)

  const reportError = useCallback((cause: unknown) => {
    const formatted = formatAppError(cause, t)
    setError(formatted.detail ? `${formatted.message} (${formatted.detail})` : formatted.message)
  }, [t])

  const handleCancelStart = useCallback(() => {
    cancelRequestedRef.current = true
  }, [])
  const handleCancelError = useCallback(() => {
    cancelRequestedRef.current = false
  }, [])
  const cancelPendingInstall = useCallback(async () => {
    const pendingId = pendingInstallRef.current
    if (!pendingId) return
    await cancelPreparedSkinInstall(pendingId)
    pendingInstallRef.current = null
    setDuplicatePrompt(null)
    setCancelled(true)
  }, [])

  const {
    paused,
    cancelling,
    togglePause,
    confirmCancelDownload: cancel,
    requestCancelDownload: prepareCancel,
    continueAfterCancelPrompt,
    dismissCancelPrompt,
    reset: resetPauseCancel,
  } = useDownloadPauseCancel({
    downloadId,
    downloadIdRef: taskIdRef,
    pauseDownloadTask: pauseSkinTask,
    resumeDownloadTask: resumeSkinTask,
    cancelDownloadTask: cancelSkinDownload,
    onError: reportError,
    onCancelStart: handleCancelStart,
    onCancelError: handleCancelError,
    onCancelIdle: cancelPendingInstall,
    cancelOnUnmount: true,
  })

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
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
    setDownloadId(taskId)
    setActiveLangGroup(item.langGroup)
    cancelRequestedRef.current = false
    setInstalling(true)
    setProgress({ phase: 'preparing', downloadedBytes: 0, totalBytes: null, paused: false })
    resetPauseCancel()
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
        reportError(cause)
      }
    } finally {
      taskIdRef.current = null
      if (mountedRef.current) {
        setDownloadId(null)
        setActiveLangGroup(null)
        setInstalling(false)
        setProgress(null)
        resetPauseCancel()
      }
    }
  }, [externalFolderNames, gamePath, onInstalled, onLinkedExternal, reportError, resetPauseCancel, t])

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
      reportError(cause)
    } finally {
      setResolvingDuplicate(false)
    }
  }, [duplicatePrompt, onInstalled, onLinkedExternal, reportError, resolvingDuplicate, t])

  return { installing, progress, paused, cancelling, cancelled, error, installedPath, warning, activeLangGroup, resultLangGroup, duplicatePrompt, resolvingDuplicate, resolveDuplicate, install, togglePause, cancel, prepareCancel, continueAfterCancelPrompt, dismissCancelPrompt, resetInstallState }
}

export type SkinInstaller = ReturnType<typeof useSkinInstaller>

