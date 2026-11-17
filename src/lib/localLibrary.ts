import type { ScannedSkin } from './skins'
import { parseStoredSkinFingerprint } from './skinFingerprint'
import type { SkinFingerprint as SkinFingerprintType } from './skinFingerprint'
import type { WtLiveItem } from './wtLive'

const storageKey = 'wt-content-manager-library-v1'
const migrationKey = 'wt-content-manager-library-file-migrated-v1'
export type { SkinFingerprint } from './skinFingerprint'

export type InstalledSkin = {
  availability: 'present' | 'missing' | 'needsReview'
  fingerprint?: SkinFingerprintType
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

export const emptyLocalLibrary: LocalLibrary = { favorites: [], installedSkins: [], externalSkinPublications: [] }

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

export function parseLocalLibrary(value: unknown): LocalLibrary {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid local library data.')
  const savedLibrary = value as Partial<LocalLibrary>
  if (!Array.isArray(savedLibrary.favorites) || !Array.isArray(savedLibrary.installedSkins)
    || (savedLibrary.externalSkinPublications !== undefined && !Array.isArray(savedLibrary.externalSkinPublications))) {
    throw new Error('Invalid local library structure.')
  }
  const favorites = Array.isArray(savedLibrary.favorites) ? savedLibrary.favorites.map(storedItem).filter((item): item is WtLiveItem => item !== null) : []
  const installedSkins = Array.isArray(savedLibrary.installedSkins) ? savedLibrary.installedSkins.flatMap(entry => {
      if (!entry || typeof entry !== 'object') return []
      const saved = entry as Partial<InstalledSkin>
      if (typeof saved.folderName !== 'string' || typeof saved.path !== 'string') return []
      const item = storedItem(saved.item) ?? undefined
      const fingerprint = parseStoredSkinFingerprint((entry as { fingerprint?: unknown }).fingerprint)
      const external = saved.externalPublication
      const externalItem = external && typeof external === 'object' ? storedItem(external.item) : null
      const externalPublication = externalItem && external && typeof external.folderPath === 'string'
        ? { item: externalItem, confirmedAt: typeof external.confirmedAt === 'string' ? external.confirmedAt : '', folderPath: external.folderPath.slice(0, 1200) }
        : undefined
      const availability = saved.availability === 'missing' ? 'missing' as const : saved.availability === 'needsReview' ? 'needsReview' as const : 'present' as const
      return [{ availability, item, externalPublication, fingerprint, folderName: saved.folderName.slice(0, 120), path: saved.path.slice(0, 1200), fileCount: Number.isFinite(saved.fileCount) ? saved.fileCount! : 0, sizeBytes: Number.isFinite(saved.sizeBytes) ? saved.sizeBytes! : 0, installedAt: typeof saved.installedAt === 'string' ? saved.installedAt : '' }]
    }) : []
  const savedLinks = Array.isArray(savedLibrary.externalSkinPublications) ? savedLibrary.externalSkinPublications : []
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
}

export function parseLocalLibraryExport(value: unknown): LocalLibrary {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid library export.')
  const exported = value as { format?: unknown; version?: unknown; library?: unknown }
  if (exported.format !== 'wt-content-manager-library' || exported.version !== 1) throw new Error('Unsupported library export.')
  return parseLocalLibrary(exported.library)
}

export function readLegacyLocalLibrary(): LocalLibrary | null {
  let raw: string | null
  try { raw = localStorage.getItem(storageKey) } catch { return null }
  return raw === null ? null : parseLocalLibrary(JSON.parse(raw) as unknown)
}

export function loadLocalLibrary(): LocalLibrary {
  return readLegacyLocalLibrary() ?? emptyLocalLibrary
}

export function removeLocalLibrary(): void {
  removeLegacyLocalLibrary()
  localStorage.removeItem(migrationKey)
}

export function removeLegacyLocalLibrary(): void {
  localStorage.removeItem(storageKey)
}

export function isLocalLibraryMigrationComplete(): boolean {
  try { return localStorage.getItem(migrationKey) === 'true' } catch { return true }
}

export function markLocalLibraryMigrationComplete(): void {
  try { localStorage.setItem(migrationKey, 'true') } catch { /* The app-data file remains authoritative. */ }
}

export function exportLocalLibrary(library: LocalLibrary): string {
  return JSON.stringify({ format: 'wt-content-manager-library', version: 1, exportedAt: new Date().toISOString(), library }, null, 2)
}

export function mergeImportedLocalLibrary(current: LocalLibrary, imported: LocalLibrary, preserveUnmatched = false): LocalLibrary {
  const favorites = [...current.favorites]
  for (const favorite of imported.favorites) {
    if (!favorites.some(saved => sameFavorite(saved, favorite))) favorites.push(favorite)
  }

  const importedByFolder = new Map(imported.installedSkins.map(entry => [entry.folderName.toLowerCase(), entry]))
  const linksByFolder = new Map(imported.externalSkinPublications.map(link => {
    const linkedEntry = imported.installedSkins.find(entry => normalizeSkinPath(entry.path) === normalizeSkinPath(link.folderPath))
    return [linkedEntry?.folderName.toLowerCase() ?? pathFolderName(link.folderPath).toLowerCase(), link] as const
  }))
  const installedSkins: InstalledSkin[] = current.installedSkins.map(entry => {
    const incoming = importedByFolder.get(entry.folderName.toLowerCase())
    const incomingLink = linksByFolder.get(entry.folderName.toLowerCase())
    const currentExternalPublication = entry.externalPublication
      ?? current.externalSkinPublications.find(link => normalizeSkinPath(link.folderPath) === normalizeSkinPath(entry.path))
    const item = entry.item ?? (currentExternalPublication ? undefined : incoming?.item)
    const externalPublication = currentExternalPublication ?? (incomingLink
      ? { ...incomingLink, folderPath: entry.path }
      : incoming?.externalPublication ? { ...incoming.externalPublication, folderPath: entry.path } : undefined)
    return { ...entry, item, externalPublication }
  })
  if (preserveUnmatched) {
    const currentFolders = new Set(installedSkins.map(entry => entry.folderName.toLowerCase()))
    installedSkins.push(...imported.installedSkins.filter(entry => !currentFolders.has(entry.folderName.toLowerCase())))
  }
  const externalSkinPublications = [...current.externalSkinPublications]
  if (preserveUnmatched) {
    for (const link of imported.externalSkinPublications) {
      if (!externalSkinPublications.some(saved => normalizeSkinPath(saved.folderPath) === normalizeSkinPath(link.folderPath))) {
        externalSkinPublications.push(link)
      }
    }
  }
  for (const entry of installedSkins) {
    const link = entry.externalPublication
    if (link && !externalSkinPublications.some(saved => normalizeSkinPath(saved.folderPath) === normalizeSkinPath(entry.path))) {
      externalSkinPublications.push({ ...link, folderPath: entry.path })
    }
  }
  return { favorites, installedSkins, externalSkinPublications }
}

function pathFolderName(value: string): string {
  const parts = value.replace(/[\\/]+$/, '').split(/[\\/]/)
  return parts[parts.length - 1] ?? value
}

export function mergeScannedSkins(scanned: ScannedSkin[], stored: InstalledSkin[], publicationLinks: ExternalSkinPublication[] = []): InstalledSkin[] {
  const storedByIdentity = new Map<string, InstalledSkin>()
  for (const entry of stored) {
    const key = skinIdentity(entry.folderName, entry.path)
    if (!storedByIdentity.has(key)) storedByIdentity.set(key, entry)
  }
  const matchedStored = new Set<string>()
  const presentEntries = scanned.map(disk => {
    const key = skinIdentity(disk.folderName, disk.path)
    const validMatch = storedByIdentity.get(key)
    if (validMatch) matchedStored.add(key)
    const externalPublication = publicationLinks.find(link => normalizeSkinPath(link.folderPath) === normalizeSkinPath(disk.path))
      ?? (validMatch?.externalPublication && normalizeSkinPath(validMatch.externalPublication.folderPath) === normalizeSkinPath(disk.path) ? validMatch.externalPublication : undefined)
    const fallbackDate = disk.modifiedAtMs ? new Date(disk.modifiedAtMs).toISOString() : ''
    return {
      availability: validMatch?.availability === 'needsReview' ? 'needsReview' as const : 'present' as const,
      fingerprint: validMatch?.fingerprint,
      item: validMatch?.item,
      externalPublication,
      folderName: disk.folderName,
      path: disk.path,
      fileCount: disk.fileCount,
      sizeBytes: disk.sizeBytes,
      installedAt: validMatch?.installedAt || fallbackDate,
    }
  })
  const missingEntries: InstalledSkin[] = []
  for (const [key, entry] of storedByIdentity) {
    if (!matchedStored.has(key)) missingEntries.push({ ...entry, availability: entry.availability === 'needsReview' ? 'needsReview' : 'missing' })
  }
  return [...presentEntries, ...missingEntries]
}

export function mergeRecoveryReviewRecords(current: LocalLibrary, recovered: LocalLibrary): LocalLibrary {
  const installedSkins = [...current.installedSkins]
  for (const recoveredEntry of recovered.installedSkins) {
    if (recoveredEntry.availability !== 'needsReview') continue
    const index = installedSkins.findIndex(entry => sameSkinIdentity(entry, recoveredEntry))
    if (index >= 0) {
      installedSkins[index] = { ...installedSkins[index], availability: 'needsReview' }
    } else {
      installedSkins.push(recoveredEntry)
    }
  }
  return { ...current, installedSkins }
}

export function removeMissingSkinRecord(library: LocalLibrary, target: InstalledSkin): LocalLibrary {
  const targetPath = normalizeSkinPath(target.path)
  return {
    ...library,
    installedSkins: library.installedSkins.filter(entry => !sameSkinIdentity(entry, target)),
    externalSkinPublications: library.externalSkinPublications.filter(link => normalizeSkinPath(link.folderPath) !== targetPath),
  }
}

function skinIdentity(folderName: string, path: string): string {
  return `${folderName.toLowerCase()}\0${normalizeSkinPath(path)}`
}

export function sameSkinIdentity(left: Pick<InstalledSkin, 'folderName' | 'path'>, right: Pick<InstalledSkin, 'folderName' | 'path'>): boolean {
  return skinIdentity(left.folderName, left.path) === skinIdentity(right.folderName, right.path)
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

