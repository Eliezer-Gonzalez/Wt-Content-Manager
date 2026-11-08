import { useCallback, useEffect, useState } from 'react'
import {
  loadDiagnosticSettings,
  openDiagnosticFolder,
  readRecentDiagnostics,
  setDiagnosticLoggingEnabled,
  type DiagnosticSettings,
} from '../lib/diagnostics'
import { isTauriRuntime } from '../lib/gameInstall'

export function useDiagnosticsSettings() {
  const [settings, setSettings] = useState<DiagnosticSettings | null>(null)
  const [busy, setBusy] = useState(false)
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
      setBusy(false)
    }
  }, [busy, settings])

  const copyLogs = useCallback(async () => {
    if (!settings?.hasLogs || busy) return
    setBusy(true)
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
      setBusy(false)
    }
  }, [busy, settings])

  const openFolder = useCallback(async () => {
    if (!settings || busy) return
    setBusy(true)
    setError('')
    setNotice('')
    try {
      await openDiagnosticFolder()
    } catch {
      setError('diagnosticsOpenFailed')
    } finally {
      setBusy(false)
    }
  }, [busy, settings])

  return {
    settings,
    supported: isTauriRuntime,
    busy,
    error,
    notice,
    toggle,
    copyLogs,
    openFolder,
  }
}
