import { useCallback, useEffect, useRef, useState } from 'react'
import { cancelSkinDownload, installSkin, setSkinDownloadPaused, type SkinInstallProgress } from '../skins'
import type { InstalledSkin } from '../lib/localLibrary'
import type { WtLiveItem } from '../wtLive'
import type { TranslateFn } from '../i18n/I18nProvider'

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
  const [warning, setWarning] = useState<string | null>(null)
  const taskIdRef = useRef<string | null>(null)
  const cancelRequestedRef = useRef(false)

  useEffect(() => {
    setError('')
    setInstalledPath('')
    setWarning(null)
    setCancelled(false)
  }, [selectionKey])

  const install = useCallback(async (item: WtLiveItem) => {
    if (!gamePath) return
    const taskId = crypto.randomUUID()
    taskIdRef.current = taskId
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
      const result = await installSkin(item.langGroup, gamePath, taskId, setProgress)
      setInstalledPath(result.path)
      setWarning(result.warning ?? null)
      onInstalled(item, result)
    } catch (cause) {
      if (cancelRequestedRef.current) setCancelled(true)
      else setError(cause instanceof Error ? cause.message : t('skinInstallFailed'))
    } finally {
      taskIdRef.current = null
      setInstalling(false)
      setProgress(null)
      setPaused(false)
      setCancelling(false)
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
      setError(cause instanceof Error ? cause.message : t('skinInstallFailed'))
    }
  }, [paused, t])

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
      setError(cause instanceof Error ? cause.message : t('skinInstallFailed'))
    }
  }, [t])

  return { installing, progress, paused, cancelling, cancelled, error, installedPath, warning, install, togglePause, cancel }
}
