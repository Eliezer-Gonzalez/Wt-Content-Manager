import { Channel, invoke } from '@tauri-apps/api/core'
import type { ExternalSkinPublication, LocalLibrary } from './localLibrary'
import type { WtLiveItem } from './wtLive'
import type { SkinFingerprint } from './skinFingerprint'

export type SkinLinkCandidate = {
  recordId: string
  recordPath: string
  folderName: string
  folderPath: string
  matchingFiles: number
  totalFiles: number
  matchingBytes: number
  totalBytes: number
  matchPercent: number
  reason: string
  sourceFingerprint?: SkinFingerprint
  item?: WtLiveItem
  externalPublication?: ExternalSkinPublication
}

export type SkinRepairProgress = { phase: string; completed: number; total: number; current: string }
export type SkinRepairResult = { library: LocalLibrary; candidates: SkinLinkCandidate[]; autoLinked: number; baselineCount: number }

export function repairSkinLinks(gamePath: string, taskId: string, onProgress: (progress: SkinRepairProgress) => void): Promise<SkinRepairResult> {
  const channel = new Channel<SkinRepairProgress>()
  channel.onmessage = onProgress
  return invoke<SkinRepairResult>('repair_skin_links', { gamePath, taskId, onProgress: channel })
}

export function cancelSkinLinkRepair(taskId: string): Promise<void> {
  return invoke('cancel_skin_link_repair', { taskId })
}

export function confirmSkinLinkCandidate(gamePath: string, candidate: SkinLinkCandidate): Promise<LocalLibrary> {
  return invoke<LocalLibrary>('confirm_skin_link_candidate', { gamePath, candidate })
}

export type ImportSkinLinksResult = { library: LocalLibrary; candidates: SkinLinkCandidate[]; autoLinked: number }

export function commitImportedSkinLinks(gamePath: string, base: LocalLibrary, proposed: LocalLibrary, importedSkins: LocalLibrary['installedSkins'], taskId: string, onProgress: (progress: SkinRepairProgress) => void): Promise<ImportSkinLinksResult> {
  const channel = new Channel<SkinRepairProgress>()
  channel.onmessage = onProgress
  return invoke<ImportSkinLinksResult>('commit_imported_skin_links', { gamePath, base, proposed, importedSkins, taskId, onProgress: channel })
}

