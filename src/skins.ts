import { invoke } from '@tauri-apps/api/core'

export type SkinInstallResult = {
  folderName: string
  path: string
  fileCount: number
  sizeBytes: number
}

export function installSkin(langGroup: number, gamePath: string): Promise<SkinInstallResult> {
  return invoke<SkinInstallResult>('install_skin', { langGroup, gamePath })
}
