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

export function installSkin(langGroup: number, gamePath: string, taskId: string, onProgress: (progress: SkinInstallProgress) => void): Promise<SkinInstallResult> {
  const channel = new Channel<SkinInstallProgress>()
  channel.onmessage = onProgress
  return invoke<SkinInstallResult>('install_skin', { langGroup, gamePath, taskId, onProgress: channel })
}

export function setSkinDownloadPaused(taskId: string, paused: boolean): Promise<void> {
  return invoke('set_skin_download_paused', { taskId, paused })
}

export function cancelSkinDownload(taskId: string): Promise<void> {
  return invoke('cancel_skin_download', { taskId })
}
