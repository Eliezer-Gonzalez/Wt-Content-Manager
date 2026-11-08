import { Channel, invoke } from '@tauri-apps/api/core'

export type SkinInstallProgress = {
  phase: 'preparing' | 'downloading' | 'extracting'
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
}

export type ScannedSkin = {
  folderName: string
  path: string
  fileCount: number
  sizeBytes: number
  modifiedAtMs: number | null
}

export function installSkin(langGroup: number, gamePath: string, taskId: string, onProgress: (progress: SkinInstallProgress) => void, replaceFolderName?: string): Promise<SkinInstallResult> {
  const channel = new Channel<SkinInstallProgress>()
  channel.onmessage = onProgress
  return invoke<SkinInstallResult>('install_skin', { langGroup, gamePath, taskId, onProgress: channel, replaceFolderName })
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

