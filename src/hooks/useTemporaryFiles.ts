import { useCallback, useEffect, useState } from 'react'
import {
  cleanupOrphanTemporaryFiles,
  getOrphanTemporaryFiles,
  type TemporaryCleanupOutcome,
  type TemporaryFileReport,
} from '../lib/settings'
import { isTauriRuntime } from '../lib/gameInstall'
import { waitForMinimumLoadingDuration } from '../lib/minimumLoadingDuration'

export function useTemporaryFiles(gamePath?: string) {
  const [report, setReport] = useState<TemporaryFileReport | null>(null)
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [lastCleanup, setLastCleanup] = useState<TemporaryCleanupOutcome | null>(null)

  const refresh = useCallback(async () => {
    if (!isTauriRuntime || !gamePath) {
      setReport(null)
      setLastCleanup(null)
      return
    }
    const startedAt = Date.now()
    setLoading(true)
    setError('')
    setLastCleanup(null)
    try {
      setReport(await getOrphanTemporaryFiles(gamePath))
    } catch {
      setError('temporaryFilesScanFailed')
    } finally {
      await waitForMinimumLoadingDuration(startedAt)
      setLoading(false)
    }
  }, [gamePath])

  useEffect(() => { void refresh() }, [refresh])

  const clean = useCallback(async () => {
    if (!gamePath || busy) return null
    const startedAt = Date.now()
    setBusy(true)
    setError('')
    setLastCleanup(null)
    try {
      const outcome = await cleanupOrphanTemporaryFiles(gamePath)
      setLastCleanup(outcome)
      setReport(await getOrphanTemporaryFiles(gamePath))
      return outcome
    } catch {
      setError('temporaryFilesCleanupFailed')
      return null
    } finally {
      await waitForMinimumLoadingDuration(startedAt)
      setBusy(false)
    }
  }, [busy, gamePath])

  return { report, loading, busy, error, lastCleanup, refresh, clean, supported: isTauriRuntime }
}
