import { invoke } from '@tauri-apps/api/core'
import { isTauriRuntime } from './gameInstall'
import { emptyLocalLibrary, isLocalLibraryMigrationComplete, loadLocalLibrary, markLocalLibraryMigrationComplete, mergeImportedLocalLibrary, parseLocalLibrary, readLegacyLocalLibrary, removeLegacyLocalLibrary, removeLocalLibrary, saveLocalLibrary, type LocalLibrary } from './localLibrary'

let pendingWrite: Promise<void> = Promise.resolve()
let resetInProgress = false

export async function loadPersistentLocalLibrary(): Promise<LocalLibrary> {
  if (!isTauriRuntime) return loadLocalLibrary()

  const stored = await invoke<unknown | null>('load_local_library')
  const migrationComplete = isLocalLibraryMigrationComplete()
  if (stored !== null) {
    let library = parseLocalLibrary(stored)
    if (!migrationComplete) {
      const legacy = readLegacyLocalLibrary()
      if (legacy) {
        library = mergeImportedLocalLibrary(library, legacy, true)
        await savePersistentLocalLibrary(library)
      }
      markLocalLibraryMigrationComplete()
      try { removeLegacyLocalLibrary() } catch { /* The marker prevents stale browser data from being merged again. */ }
    }
    return library
  }

  const library = readLegacyLocalLibrary() ?? emptyLocalLibrary
  await savePersistentLocalLibrary(library)
  markLocalLibraryMigrationComplete()
  try { removeLegacyLocalLibrary() } catch { /* The marker prevents stale browser data from being merged again. */ }
  return library
}

export function savePersistentLocalLibrary(library: LocalLibrary): Promise<void> {
  if (resetInProgress) return Promise.reject(new Error('Local library reset is in progress.'))
  if (!isTauriRuntime) {
    saveLocalLibrary(library)
    return Promise.resolve()
  }

  const write = pendingWrite.catch(() => undefined).then(() => invoke<void>('save_local_library', { library }))
  pendingWrite = write
  return write
}

export async function clearPersistentLocalLibrary(): Promise<void> {
  if (!isTauriRuntime) {
    removeLocalLibrary()
    return
  }

  if (resetInProgress) throw new Error('Local library reset is already in progress.')
  resetInProgress = true
  const clear = pendingWrite.catch(() => undefined).then(() => invoke<void>('clear_local_library'))
  pendingWrite = clear
  try {
    await clear
    removeLocalLibrary()
  } catch (error) {
    resetInProgress = false
    throw error
  }
}
