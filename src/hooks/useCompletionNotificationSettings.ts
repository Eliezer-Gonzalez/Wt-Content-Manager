import { useCallback, useState } from 'react'

const storageKey = 'wt-content-manager-completion-notifications-v1'

export type CompletionNotificationPreferences = {
  showNotifications: boolean
  soundEnabled: boolean
  volume: number
}

const defaults: CompletionNotificationPreferences = {
  showNotifications: true,
  soundEnabled: true,
  volume: 60,
}

function readPreferences(): CompletionNotificationPreferences {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(storageKey) ?? 'null')
    if (!value || typeof value !== 'object' || Array.isArray(value)) return defaults
    const saved = value as Partial<CompletionNotificationPreferences>
    return {
      showNotifications: typeof saved.showNotifications === 'boolean' ? saved.showNotifications : defaults.showNotifications,
      soundEnabled: typeof saved.soundEnabled === 'boolean' ? saved.soundEnabled : defaults.soundEnabled,
      volume: typeof saved.volume === 'number' && Number.isFinite(saved.volume)
        ? Math.max(0, Math.min(100, Math.round(saved.volume)))
        : defaults.volume,
    }
  } catch {
    return defaults
  }
}

export function useCompletionNotificationSettings() {
  const [preferences, setPreferences] = useState(readPreferences)

  const update = useCallback((patch: Partial<CompletionNotificationPreferences>) => {
    setPreferences(current => {
      const next = { ...current, ...patch }
      try {
        localStorage.setItem(storageKey, JSON.stringify(next))
      } catch {
        // Keep the current-session choice when browser storage is unavailable.
      }
      return next
    })
  }, [])

  return {
    preferences,
    setShowNotifications: (showNotifications: boolean) => update({ showNotifications }),
    setSoundEnabled: (soundEnabled: boolean) => update({ soundEnabled }),
    setVolume: (volume: number) => update({ volume: Math.max(0, Math.min(100, Math.round(volume))) }),
  }
}
