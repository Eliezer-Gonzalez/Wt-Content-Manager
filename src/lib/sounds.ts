import { Channel, invoke } from '@tauri-apps/api/core'

export type SoundPackage = {
  id: string
  langGroup: number
  title: string
  author: string
  archiveName: string
  sizeBytes: number
  downloadedAt: number
}

export type SoundDownloadProgress = {
  phase: 'downloading'
  downloadedBytes: number
  totalBytes: number | null
  paused: boolean
}

export type SoundModStatus = {
  gameRunning: boolean
  processStatus: 'running' | 'stopped' | 'unknown'
  installedBanks: number
  backupAvailable: boolean
  activePackageId: string | null
}

export type SoundInstallResult = {
  packageId: string
  installedBanks: number
  backupCreated: boolean
}

export function listSoundPackages(): Promise<SoundPackage[]> {
  return invoke<SoundPackage[]>('list_sound_packages')
}

export function downloadSoundPackage(
  item: { langGroup: number; title: string; author: string },
  taskId: string,
  onProgress: (progress: SoundDownloadProgress) => void,
): Promise<SoundPackage> {
  const channel = new Channel<SoundDownloadProgress>()
  channel.onmessage = onProgress
  return invoke<SoundPackage>('download_sound_package', {
    langGroup: item.langGroup,
    title: item.title,
    author: item.author,
    taskId,
    onProgress: channel,
  })
}

export function setSoundDownloadPaused(taskId: string, paused: boolean): Promise<void> {
  return invoke('set_sound_download_paused', { taskId, paused })
}

export function cancelSoundDownload(taskId: string): Promise<void> {
  return invoke('cancel_sound_download', { taskId })
}

export function getSoundModStatus(gamePath: string): Promise<SoundModStatus> {
  return invoke<SoundModStatus>('get_sound_mod_status', { gamePath })
}

export function installSoundPackage(gamePath: string, packageId: string): Promise<SoundInstallResult> {
  return invoke<SoundInstallResult>('install_sound_package', { gamePath, packageId })
}

export function restoreSoundModBackup(gamePath: string): Promise<void> {
  return invoke('restore_sound_mod_backup', { gamePath })
}
