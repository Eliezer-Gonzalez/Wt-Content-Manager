import { invoke } from '@tauri-apps/api/core'
import { isTauriRuntime } from './gameInstall'

export type DiagnosticSettings = {
  enabled: boolean
  hasLogs: boolean
  directory: string
}

let cachedSettings: DiagnosticSettings | null = null
let captureInstalled = false

export async function loadDiagnosticSettings(): Promise<DiagnosticSettings> {
  if (!isTauriRuntime) throw new Error('Diagnostic files are only available in the desktop app.')
  cachedSettings ??= await invoke<DiagnosticSettings>('get_diagnostic_settings')
  return cachedSettings
}

export async function setDiagnosticLoggingEnabled(enabled: boolean): Promise<DiagnosticSettings> {
  await invoke('set_diagnostic_logging_enabled', { enabled })
  cachedSettings = { ...(await loadDiagnosticSettings()), enabled }
  return cachedSettings
}

export async function readRecentDiagnostics(): Promise<string> {
  return invoke<string>('read_recent_diagnostics')
}

export async function openDiagnosticFolder(): Promise<void> {
  await invoke('open_diagnostics_folder')
}

export async function recordFrontendError(source: string, error: unknown): Promise<void> {
  if (!isTauriRuntime || !cachedSettings?.enabled) return
  const message = error instanceof Error ? error.message : String(error)
  if (!message.trim()) return
  await invoke('write_diagnostic', {
    level: 'error',
    source,
    message: message.slice(0, 4_000),
  }).catch(() => undefined)
}

export async function initializeDiagnosticCapture(): Promise<void> {
  if (!isTauriRuntime) return
  try {
    await loadDiagnosticSettings()
  } catch {
    return
  }
  if (captureInstalled) return
  captureInstalled = true
  window.addEventListener('error', event => {
    void recordFrontendError('frontend_uncaught_error', event.message)
  })
  window.addEventListener('unhandledrejection', event => {
    void recordFrontendError('frontend_unhandled_rejection', event.reason)
  })
}
