import { useCallback, useEffect, useState } from 'react'
import {
  chooseGameInstallation,
  detectGameInstallations,
  isTauriRuntime,
  savedGamePath,
  saveGamePath,
  validateSavedGamePath,
  type GameInstall,
} from '../lib/gameInstall'

const setupSeenKey = 'wt-content-manager-game-setup-seen'

function hasSeenSetup() {
  try { return localStorage.getItem(setupSeenKey) === 'true' } catch { return false }
}

function markSetupSeen() {
  try { localStorage.setItem(setupSeenKey, 'true') } catch { /* Optional convenience only. */ }
}

function arrangeInstallations(detected: GameInstall[], preferred: GameInstall | null) {
  if (!preferred) return detected
  return [preferred, ...detected.filter(install => install.path.toLowerCase() !== preferred.path.toLowerCase())]
}

export function useGameInstallation() {
  const [installations, setInstallations] = useState<GameInstall[]>([])
  const [gameInstall, setGameInstall] = useState<GameInstall | null>(null)
  const [selected, setSelected] = useState<GameInstall | null>(null)
  const [isOpen, setIsOpen] = useState(() => isTauriRuntime && !hasSeenSetup())
  const [loading, setLoading] = useState(isTauriRuntime)
  const [error, setError] = useState<unknown>(null)

  const scan = useCallback(async () => {
    if (!isTauriRuntime) return
    setLoading(true)
    setError(null)
    try {
      const saved = savedGamePath()
      const [preferred, detected] = await Promise.all([
        saved ? validateSavedGamePath(saved) : Promise.resolve(null),
        detectGameInstallations(),
      ])
      const all = arrangeInstallations(detected, preferred)
      setInstallations(all)
      setSelected(current => all.find(install => install.path.toLowerCase() === current?.path.toLowerCase()) ?? all[0] ?? null)
      setGameInstall(preferred ?? all[0] ?? null)
      if (all.length === 0) setError('gameSetupNoResult')
    } catch {
      setError('gameSetupScanFailed')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!isTauriRuntime) return
    void scan()
  }, [scan])

  function openSetup() {
    setError(null)
    setIsOpen(true)
    void scan()
  }

  function closeSetup() {
    markSetupSeen()
    setIsOpen(false)
  }

  function confirmInstallation(install: GameInstall) {
    saveGamePath(install.path)
    setGameInstall(install)
    setSelected(install)
    closeSetup()
  }

  async function chooseManual(title: string) {
    setError(null)
    try {
      const install = await chooseGameInstallation(title)
      if (!install) return
      setInstallations(current => arrangeInstallations(current, install))
      confirmInstallation(install)
    } catch (cause) {
      setError(cause || 'gameSetupInvalidPath')
    }
  }

  return {
    installations,
    gameInstall,
    selected,
    selectInstallation: setSelected,
    isOpen,
    loading,
    error,
    scan,
    openSetup,
    closeSetup,
    confirmInstallation,
    chooseManual,
  }
}
