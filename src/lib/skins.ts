import { Channel, invoke } from '@tauri-apps/api/core'

export type SkinInstallProgress = {
  phase: 'preparing' | 'downloading' | 'extracting' | 'comparing'
  downloadedBytes: number
  totalBytes: number | null
  paused: boolean
}

export type SkinInstallResult = {
  folderName: string
  path: string
  fileCount: number
  sizeBytes: number
  skippedFiles: number
  skippedExecutables: number
  missingTextureCount: number
  missingTextureNames: string[]
}

export type DuplicateSkinCandidate = {
  folderName: string
  path: string
  exactContent: boolean
  folderNameMatch: boolean
  sameLayout: boolean
  fileCount: number
  sizeBytes: number
}

export type SkinInstallOutcome =
  | { status: 'installed'; result: SkinInstallResult }
  | { status: 'duplicateFound'; pendingId: string; candidates: DuplicateSkinCandidate[] }
  | { status: 'linkedExisting'; folderName: string; path: string }
  | { status: 'cancelled' }

export type ScannedSkin = {
  folderName: string
  path: string
  fileCount: number
  sizeBytes: number
  modifiedAtMs: number | null
}

export function installSkin(langGroup: number, gamePath: string, taskId: string, onProgress: (progress: SkinInstallProgress) => void, replaceFolderName?: string, externalFolderNames: string[] = []): Promise<SkinInstallOutcome> {
  const channel = new Channel<SkinInstallProgress>()
  channel.onmessage = onProgress
  return invoke<SkinInstallOutcome>('install_skin', { langGroup, gamePath, taskId, onProgress: channel, replaceFolderName, externalFolderNames })
}

export function resolvePreparedSkinInstall(pendingId: string, action: 'install_copy' | 'link_existing' | 'replace_existing' | 'cancel', folderName?: string): Promise<SkinInstallOutcome> {
  return invoke<SkinInstallOutcome>('resolve_prepared_skin_install', { pendingId, action, folderName })
}

export function cancelPreparedSkinInstall(pendingId: string): Promise<void> {
  return invoke('cancel_prepared_skin_install', { pendingId })
}

export function setSkinDownloadPaused(taskId: string, paused: boolean): Promise<void> {
  return invoke('set_skin_download_paused', { taskId, paused })
}

export function cancelSkinDownload(taskId: string): Promise<void> {
  return invoke('cancel_skin_download', { taskId })
}

export function scanInstalledSkins(gamePath: string): Promise<ScannedSkin[]> {
  return invoke<ScannedSkin[]>('scan_installed_skins', { gamePath })
}

export function uninstallSkin(gamePath: string, folderName: string): Promise<void> {
  return invoke('uninstall_skin', { gamePath, folderName })
}

