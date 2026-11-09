import { useCallback, useEffect, useState } from 'react'
import {
  loadDiagnosticSettings,
  openDiagnosticFolder,
  readRecentDiagnostics,
  setDiagnosticLoggingEnabled,
  type DiagnosticSettings,
} from '../lib/diagnostics'
import { isTauriRuntime } from '../lib/gameInstall'
import { waitForMinimumLoadingDuration } from '../lib/minimumLoadingDuration'

type DiagnosticsAction = 'toggle' | 'copy' | 'open'

export function useDiagnosticsSettings() {
  const [settings, setSettings] = useState<DiagnosticSettings | null>(null)
  const [busy, setBusy] = useState(false)
  const [action, setAction] = useState<DiagnosticsAction | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  useEffect(() => {
    if (!isTauriRuntime) return
    let active = true
    void loadDiagnosticSettings()
      .then(value => { if (active) setSettings(value) })
      .catch(() => { if (active) setError('diagnosticsUnavailable') })
    return () => { active = false }
  }, [])

  const toggle = useCallback(async () => {
    if (!settings || busy) return
    const startedAt = Date.now()
    setAction('toggle')
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const next = await setDiagnosticLoggingEnabled(!settings.enabled)
      setSettings(next)
      setNotice(next.enabled ? 'diagnosticsEnabledNotice' : 'diagnosticsDisabledNotice')
    } catch {
      setError('diagnosticsSettingsFailed')
    } finally {
      await waitForMinimumLoadingDuration(startedAt)
      setBusy(false)
      setAction(null)
    }
  }, [busy, settings])

  const copyLogs = useCallback(async () => {
    if (!settings?.hasLogs || busy) return
    const startedAt = Date.now()
    setAction('copy')
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const contents = await readRecentDiagnostics()
      if (!contents.trim()) {
        setError('')
        setNotice('diagnosticsNoLogsNotice')
      } else {
        await navigator.clipboard.writeText(contents)
        setError('')
        setNotice('diagnosticsCopiedNotice')
      }
    } catch {
      setNotice('')
      setError('diagnosticsCopyFailed')
    } finally {
      await waitForMinimumLoadingDuration(startedAt)
      setBusy(false)
      setAction(null)
    }
  }, [busy, settings])

  const openFolder = useCallback(async () => {
    if (!settings || busy) return
    const startedAt = Date.now()
    setAction('open')
    setBusy(true)
    setError('')
    setNotice('')
    try {
      await openDiagnosticFolder()
    } catch {
      setError('diagnosticsOpenFailed')
    } finally {
      await waitForMinimumLoadingDuration(startedAt)
      setBusy(false)
      setAction(null)
    }
  }, [busy, settings])

  return {
    settings,
    supported: isTauriRuntime,
    busy,
    action,
    error,
    notice,
    toggle,
    copyLogs,
    openFolder,
  }
}
