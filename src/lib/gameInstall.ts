import { invoke } from '@tauri-apps/api/core'
import { open } from '@tauri-apps/plugin-dialog'

export type GameInstall = { path: string; source: string }
export const isTauriRuntime = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
const savedPathKey = 'wt-content-manager-game-path'

export async function detectGameInstallations(): Promise<GameInstall[]> {
  if (!isTauriRuntime) return []
  return invoke<GameInstall[]>('detect_game_installations')
}

export async function chooseGameInstallation(title: string): Promise<GameInstall | null> {
  if (!isTauriRuntime) return null
  const path = await open({ directory: true, multiple: false, title })
  if (typeof path !== 'string') return null
  const install = await invoke<GameInstall>('validate_game_installation', { path })
  return install
}

export function saveGamePath(path: string) {
  try { localStorage.setItem(savedPathKey, path) } catch { /* Optional convenience only. */ }
}

export function savedGamePath(): string | null {
  try { return localStorage.getItem(savedPathKey) } catch { return null }
}

export async function validateSavedGamePath(path: string): Promise<GameInstall | null> {
  if (!isTauriRuntime) return null
  try { return await invoke<GameInstall>('validate_game_installation', { path }) } catch { return null }
}
