import type { ScannedSkin } from './skins'
import type { WtLiveItem } from './wtLive'

const storageKey = 'wt-content-manager-library-v1'

export type InstalledSkin = {
  item?: WtLiveItem
  externalPublication?: {
    item: WtLiveItem
    confirmedAt: string
    folderPath: string
  }
  folderName: string
  path: string
  fileCount: number
  sizeBytes: number
  installedAt: string
}

export type ExternalSkinPublication = {
  item: WtLiveItem
  confirmedAt: string
  folderPath: string
}

export type LocalLibrary = {
  favorites: WtLiveItem[]
  installedSkins: InstalledSkin[]
  externalSkinPublications: ExternalSkinPublication[]
}

export function sameFavorite(left: WtLiveItem, right: WtLiveItem): boolean {
  return left.id === right.id && (left.contentType ?? 'camouflage') === (right.contentType ?? 'camouflage')
}

const emptyLibrary: LocalLibrary = { favorites: [], installedSkins: [], externalSkinPublications: [] }

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
    contentType: item.contentType === 'sound' ? 'sound' : 'camouflage',
    id: item.id!, langGroup: item.langGroup!, language: typeof item.language === 'string' ? item.language.slice(0, 12) : 'en',
    title: item.title.slice(0, 300), description: typeof item.description === 'string' ? item.description.slice(0, 4000) : '',
    author: item.author.slice(0, 200), createdAt: Number.isFinite(item.createdAt) ? item.createdAt! : 0,
    imageUrl: safeWtUrl(item.imageUrl),
    imageAspectRatio: typeof item.imageAspectRatio === 'number' && Number.isFinite(item.imageAspectRatio) && item.imageAspectRatio > 0 ? item.imageAspectRatio : undefined,
    downloadUrl: safeWtUrl(item.downloadUrl),
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
      if (typeof saved.folderName !== 'string' || typeof saved.path !== 'string') return []
      const item = storedItem(saved.item) ?? undefined
      const external = saved.externalPublication
      const externalItem = external && typeof external === 'object' ? storedItem(external.item) : null
      const externalPublication = externalItem && external && typeof external.folderPath === 'string'
        ? { item: externalItem, confirmedAt: typeof external.confirmedAt === 'string' ? external.confirmedAt : '', folderPath: external.folderPath.slice(0, 1200) }
        : undefined
      return [{ item, externalPublication, folderName: saved.folderName.slice(0, 120), path: saved.path.slice(0, 1200), fileCount: Number.isFinite(saved.fileCount) ? saved.fileCount! : 0, sizeBytes: Number.isFinite(saved.sizeBytes) ? saved.sizeBytes! : 0, installedAt: typeof saved.installedAt === 'string' ? saved.installedAt : '' }]
    }) : []
    const savedLinks = Array.isArray(value.externalSkinPublications) ? value.externalSkinPublications : []
    const externalSkinPublications = savedLinks.flatMap(saved => {
      if (!saved || typeof saved !== 'object') return []
      const link = saved as Partial<ExternalSkinPublication>
      const item = storedItem(link.item)
      if (!item || typeof link.folderPath !== 'string') return []
      return [{ item, folderPath: link.folderPath.slice(0, 1200), confirmedAt: typeof link.confirmedAt === 'string' ? link.confirmedAt : '' }]
    })
    for (const entry of installedSkins) {
      const link = entry.externalPublication
      if (link && !externalSkinPublications.some(saved => normalizeSkinPath(saved.folderPath) === normalizeSkinPath(link.folderPath))) {
        externalSkinPublications.push(link)
      }
    }
    return {
      favorites: [...new Map(favorites.map(item => [`${item.contentType ?? 'camouflage'}:${item.id}`, item])).values()],
      installedSkins,
      externalSkinPublications,
    }
  } catch { return emptyLibrary }
}

export function mergeScannedSkins(scanned: ScannedSkin[], stored: InstalledSkin[], publicationLinks: ExternalSkinPublication[] = []): InstalledSkin[] {
  const storedByIdentity = new Map<string, InstalledSkin>()
  for (const entry of stored) {
    const key = `${entry.folderName.toLowerCase()}\0${normalizeSkinPath(entry.path)}`
    if (!storedByIdentity.has(key)) storedByIdentity.set(key, entry)
  }
  return scanned.map(disk => {
    const key = `${disk.folderName.toLowerCase()}\0${normalizeSkinPath(disk.path)}`
    const validMatch = storedByIdentity.get(key)
    const externalPublication = publicationLinks.find(link => normalizeSkinPath(link.folderPath) === normalizeSkinPath(disk.path))
      ?? (validMatch?.externalPublication && normalizeSkinPath(validMatch.externalPublication.folderPath) === normalizeSkinPath(disk.path) ? validMatch.externalPublication : undefined)
    const fallbackDate = disk.modifiedAtMs ? new Date(disk.modifiedAtMs).toISOString() : ''
    return {
      item: validMatch?.item,
      externalPublication,
      folderName: disk.folderName,
      path: disk.path,
      fileCount: disk.fileCount,
      sizeBytes: disk.sizeBytes,
      installedAt: validMatch?.installedAt || fallbackDate,
    }
  })
}

export function getSkinPublication(entry: InstalledSkin): WtLiveItem | undefined {
  return entry.item ?? entry.externalPublication?.item
}

export function linkExternalSkinPublication(entries: InstalledSkin[], folderPath: string, item: WtLiveItem): InstalledSkin[] {
  const target = normalizeSkinPath(folderPath)
  return entries.map(entry => normalizeSkinPath(entry.path) === target
    ? { ...entry, externalPublication: { item, confirmedAt: new Date().toISOString(), folderPath: entry.path } }
    : entry)
}

export function unlinkExternalSkinPublication(entries: InstalledSkin[], folderPath: string): InstalledSkin[] {
  const target = normalizeSkinPath(folderPath)
  return entries.map(entry => {
    if (normalizeSkinPath(entry.path) !== target) return entry
    const { externalPublication: _removed, ...rest } = entry
    return rest
  })
}

export function upsertExternalSkinPublication(links: ExternalSkinPublication[], folderPath: string, item: WtLiveItem): ExternalSkinPublication[] {
  const target = normalizeSkinPath(folderPath)
  const link = { item, confirmedAt: new Date().toISOString(), folderPath }
  return [...links.filter(saved => normalizeSkinPath(saved.folderPath) !== target), link]
}

export function removeExternalSkinPublication(links: ExternalSkinPublication[], folderPath: string): ExternalSkinPublication[] {
  const target = normalizeSkinPath(folderPath)
  return links.filter(saved => normalizeSkinPath(saved.folderPath) !== target)
}

function normalizeSkinPath(value: string): string {
  let path = value.replace(/\//g, '\\')
  if (path.toLowerCase().startsWith('\\\\?\\unc\\')) {
    path = `\\\\${path.slice(8)}`
  } else if (path.startsWith('\\\\?\\')) {
    path = path.slice(4)
  }
  return path.replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase()
}

export function saveLocalLibrary(library: LocalLibrary): void {
  try { localStorage.setItem(storageKey, JSON.stringify(library)) } catch { /* Keep the current session usable when storage is unavailable. */ }
}

