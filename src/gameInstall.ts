import { invoke } from '@tauri-apps/api/core'
import { open } from '@tauri-apps/plugin-dialog'

export type GameInstall = { path: string; source: string }
const isDesktop = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
const savedPathKey = 'wt-content-manager-game-path'

export async function detectGameInstallations(): Promise<GameInstall[]> {
  if (!isDesktop) return []
  return invoke<GameInstall[]>('detect_game_installations')
}

export async function chooseGameInstallation(): Promise<GameInstall | null> {
  if (!isDesktop) return null
  const path = await open({ directory: true, multiple: false, title: 'Selecciona la carpeta raíz de War Thunder' })
  if (typeof path !== 'string') return null
  const install = await invoke<GameInstall>('validate_game_installation', { path })
  try { localStorage.setItem(savedPathKey, install.path) } catch { /* Optional convenience only. */ }
  return install
}

export function savedGamePath(): string | null {
  try { return localStorage.getItem(savedPathKey) } catch { return null }
}

export async function validateSavedGamePath(path: string): Promise<GameInstall | null> {
  if (!isDesktop) return null
  try { return await invoke<GameInstall>('validate_game_installation', { path }) } catch { return null }
}
