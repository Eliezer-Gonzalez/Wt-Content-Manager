import { invoke } from '@tauri-apps/api/core'

export type TemporaryFileReport = {
  directoryCount: number
  totalBytes: number
  recoveryRequiredCount: number
}

export type TemporaryCleanupOutcome = {
  removedDirectories: number
  freedBytes: number
  failedDirectories: number
  recoveryRequiredCount: number
}

export function getOrphanTemporaryFiles(gamePath: string): Promise<TemporaryFileReport> {
  return invoke<TemporaryFileReport>('get_orphan_temporary_files', { gamePath })
}

export function cleanupOrphanTemporaryFiles(gamePath: string): Promise<TemporaryCleanupOutcome> {
  return invoke<TemporaryCleanupOutcome>('cleanup_orphan_temporary_files', { gamePath })
}

export function openUserSkinsFolder(gamePath: string): Promise<void> {
  return invoke('open_user_skins_folder', { gamePath })
}
