import { isTauriRuntime } from './gameInstall'
import { clearPersistentLocalLibrary } from './localLibraryPersistence'

const localDataKeys = [
  'wt-content-manager-library-v1',
  'wt-content-manager-library-file-migrated-v1',
  'wt-content-manager-game-path',
  'wt-content-manager-searches',
  'wt-content-manager-home-sections-v1',
  'wt-content-manager-game-setup-seen',
  'wt-content-manager-independent-notice-v4',
  'wt-content-manager-language',
  'wt-content-manager-image-quality-v1',
  'wt-content-manager-sound-package-updates',
  'wt-content-manager-completion-notifications-v1',
] as const

export async function resetLocalData(): Promise<void> {
  if (isTauriRuntime) await clearPersistentLocalLibrary()
  for (const key of localDataKeys) localStorage.removeItem(key)
}
