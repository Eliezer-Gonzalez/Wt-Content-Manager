import type { WtLiveItem } from '../wtLive'

const storageKey = 'wt-content-manager-library-v1'

export type InstalledSkin = {
  item: WtLiveItem
  folderName: string
  path: string
  fileCount: number
  sizeBytes: number
  installedAt: string
}

export type LocalLibrary = {
  favorites: WtLiveItem[]
  installedSkins: InstalledSkin[]
}

const emptyLibrary: LocalLibrary = { favorites: [], installedSkins: [] }

function safeWtUrl(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && (url.hostname === 'warthunder.com' || url.hostname.endsWith('.warthunder.com')) ? url.href : undefined
  } catch { return undefined }
}

function storedItem(value: unknown): WtLiveItem | null {
  if (!value || typeof value !== 'object') return null
  const item = value as Partial<WtLiveItem>
  if (!Number.isSafeInteger(item.id) || !Number.isSafeInteger(item.langGroup) || typeof item.title !== 'string' || typeof item.author !== 'string') return null
  return {
    id: item.id!, langGroup: item.langGroup!, language: typeof item.language === 'string' ? item.language.slice(0, 12) : 'en',
    title: item.title.slice(0, 300), description: typeof item.description === 'string' ? item.description.slice(0, 4000) : '',
    author: item.author.slice(0, 200), createdAt: Number.isFinite(item.createdAt) ? item.createdAt! : 0,
    imageUrl: safeWtUrl(item.imageUrl), downloadUrl: safeWtUrl(item.downloadUrl),
    fileName: typeof item.fileName === 'string' ? item.fileName.slice(0, 260) : undefined,
    likes: Number.isFinite(item.likes) ? item.likes! : 0, downloads: Number.isFinite(item.downloads) ? item.downloads! : 0,
  }
}

export function loadLocalLibrary(): LocalLibrary {
  try {
    const value = JSON.parse(localStorage.getItem(storageKey) ?? 'null') as Partial<LocalLibrary> | null
    if (!value || typeof value !== 'object') return emptyLibrary
    const favorites = Array.isArray(value.favorites) ? value.favorites.map(storedItem).filter((item): item is WtLiveItem => item !== null) : []
    const installedSkins = Array.isArray(value.installedSkins) ? value.installedSkins.flatMap(entry => {
      if (!entry || typeof entry !== 'object') return []
      const saved = entry as Partial<InstalledSkin>
      const item = storedItem(saved.item)
      if (!item || typeof saved.folderName !== 'string' || typeof saved.path !== 'string') return []
      return [{ item, folderName: saved.folderName.slice(0, 120), path: saved.path.slice(0, 1000), fileCount: Number.isFinite(saved.fileCount) ? saved.fileCount! : 0, sizeBytes: Number.isFinite(saved.sizeBytes) ? saved.sizeBytes! : 0, installedAt: typeof saved.installedAt === 'string' ? saved.installedAt : '' }]
    }) : []
    return { favorites: [...new Map(favorites.map(item => [item.id, item])).values()], installedSkins }
  } catch { return emptyLibrary }
}

export function saveLocalLibrary(library: LocalLibrary): void {
  try { localStorage.setItem(storageKey, JSON.stringify(library)) } catch { /* Keep the current session usable when storage is unavailable. */ }
}
