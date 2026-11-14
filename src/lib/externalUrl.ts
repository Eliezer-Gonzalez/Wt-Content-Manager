import { invoke } from '@tauri-apps/api/core'

export async function openExternalHttpsUrl(url: string): Promise<void> {
  await invoke('open_external_https_url', { url })
}
