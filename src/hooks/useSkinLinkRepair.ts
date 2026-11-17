import { useCallback, useRef, useState } from 'react'
import { isTauriRuntime } from '../lib/gameInstall'
import { parseLocalLibraryExport, type LocalLibrary } from '../lib/localLibrary'
import { cancelSkinLinkRepair, commitImportedSkinLinks, confirmSkinLinkCandidate, repairSkinLinks, type SkinLinkCandidate, type SkinRepairProgress } from '../lib/skinRepair'
import { createImportedLibraryPlan } from '../lib/skinLinkRepairPlan'
import { savePersistentLocalLibrary } from '../lib/localLibraryPersistence'

export function useSkinLinkRepair(gamePath: string | undefined, library: LocalLibrary, replaceLibrary: (next: LocalLibrary) => void) {
  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState<SkinRepairProgress | null>(null)
  const [candidates, setCandidates] = useState<SkinLinkCandidate[]>([])
  const [dialogOpen, setDialogOpen] = useState(false)
  const [baselineCount, setBaselineCount] = useState(0)
  const [autoLinked, setAutoLinked] = useState(0)
  const [resolving, setResolving] = useState(false)
  const [error, setError] = useState<'' | 'skinRepairFailed' | 'skinRepairCandidateFailed'>('')
  const taskIdRef = useRef<string | null>(null)
  const cancelRequestedRef = useRef(false)
  const startInProgressRef = useRef(false)

  const start = useCallback(async () => {
    if (!isTauriRuntime || !gamePath || taskIdRef.current || startInProgressRef.current) return
    startInProgressRef.current = true
    cancelRequestedRef.current = false
    setRunning(true)
    setProgress({ phase: 'scanning', completed: 0, total: 0, current: '' })
    setCandidates([])
    setError('')
    try {
      await savePersistentLocalLibrary(library)
      if (cancelRequestedRef.current) return
      const taskId = crypto.randomUUID().replace(/-/g, '')
      taskIdRef.current = taskId
      const result = await repairSkinLinks(gamePath, taskId, setProgress)
      replaceLibrary(result.library)
      setCandidates(result.candidates)
      setAutoLinked(result.autoLinked)
      setBaselineCount(result.baselineCount)
      setDialogOpen(true)
    } catch (cause) {
      const code = typeof cause === 'object' && cause !== null && 'code' in cause
        ? String((cause as { code: unknown }).code)
        : cause instanceof Error ? cause.message : String(cause)
      if (!code.includes('download_cancelled')) {
        setError('skinRepairFailed')
        setDialogOpen(true)
      }
    } finally {
      taskIdRef.current = null
      startInProgressRef.current = false
      setRunning(false)
      setProgress(null)
    }
  }, [gamePath, library, replaceLibrary, running])

  const cancel = useCallback(async () => {
    cancelRequestedRef.current = true
    const taskId = taskIdRef.current
    if (!taskId) return
    if (progress?.phase !== 'finalizing') await cancelSkinLinkRepair(taskId).catch(() => undefined)
  }, [progress?.phase])

  const confirm = useCallback(async (candidate: SkinLinkCandidate) => {
    if (!gamePath || resolving) return
    setResolving(true)
    setError('')
    try {
      const saved = await confirmSkinLinkCandidate(gamePath, candidate)
      replaceLibrary(saved)
      setCandidates(current => current.filter(item => item !== candidate))
    } catch {
      setError('skinRepairCandidateFailed')
    } finally {
      setResolving(false)
    }
  }, [gamePath, replaceLibrary, resolving])

  const importLibrary = useCallback(async (value: unknown) => {
    const imported = parseLocalLibraryExport(value)
    const plan = createImportedLibraryPlan(library, imported)
    if (!isTauriRuntime || !gamePath) {
      const result = { library: { ...library, favorites: plan.library.favorites }, candidates: plan.candidates, autoLinked: 0 }
      await savePersistentLocalLibrary(result.library)
      replaceLibrary(result.library)
      setCandidates(result.candidates)
      setAutoLinked(0)
      setBaselineCount(0)
      setDialogOpen(result.candidates.length > 0)
      return { autoLinked: 0, candidates: result.candidates.length }
    }
    if (startInProgressRef.current || taskIdRef.current) throw new Error('Skin repair is already running.')
    startInProgressRef.current = true
    cancelRequestedRef.current = false
    setRunning(true)
    setProgress({ phase: 'scanning', completed: 0, total: 0, current: '' })
    setCandidates([])
    setDialogOpen(false)
    setError('')
    try {
      await savePersistentLocalLibrary(library)
      if (cancelRequestedRef.current) return { autoLinked: 0, candidates: 0, cancelled: true }
      const taskId = crypto.randomUUID().replace(/-/g, '')
      taskIdRef.current = taskId
      const result = await commitImportedSkinLinks(gamePath, library, plan.library, imported.installedSkins, taskId, setProgress)
      replaceLibrary(result.library)
      setCandidates(result.candidates)
      setAutoLinked(result.autoLinked)
      setBaselineCount(0)
      setDialogOpen(result.candidates.length > 0)
      return { autoLinked: result.autoLinked, candidates: result.candidates.length }
    } catch (cause) {
      const code = typeof cause === 'object' && cause !== null && 'code' in cause
        ? String((cause as { code: unknown }).code)
        : cause instanceof Error ? cause.message : String(cause)
      if (code.includes('download_cancelled')) return { autoLinked: 0, candidates: 0, cancelled: true }
      throw cause
    } finally {
      taskIdRef.current = null
      startInProgressRef.current = false
      setRunning(false)
      setProgress(null)
    }
  }, [gamePath, library, replaceLibrary])

  const close = useCallback(() => {
    if (running || resolving) return
    setCandidates([])
    setDialogOpen(false)
    setError('')
  }, [resolving, running])

  return { running, progress, candidates, dialogOpen, baselineCount, autoLinked, resolving, error: error || undefined, start, cancel, confirm, importLibrary, close }
}
