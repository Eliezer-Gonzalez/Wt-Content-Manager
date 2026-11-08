import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './styles.css'
import { I18nProvider } from './i18n/I18nProvider'
import { initializeDiagnosticCapture } from './lib/diagnostics'

async function startApp() {
  await initializeDiagnosticCapture().catch(() => undefined)
  createRoot(document.getElementById('root')!).render(<React.StrictMode><I18nProvider><App /></I18nProvider></React.StrictMode>)
}

void startApp()

