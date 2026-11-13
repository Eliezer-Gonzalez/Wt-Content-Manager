import type { InstalledSkin } from './localLibrary'
import type { SoundPackage } from './sounds'

export type DownloadOriginFilter = 'all' | 'app' | 'external'
export type DownloadSortOrder = 'recent' | 'oldest' | 'largest' | 'smallest'
export type SoundDownloadStatusFilter = 'all' | 'active' | 'inactive'

export function filterAndSortInstalledSkins(
  entries: InstalledSkin[],
  query: string,
  origin: DownloadOriginFilter,
  order: DownloadSortOrder,
): InstalledSkin[] {
  const normalizedQuery = query.trim().toLocaleLowerCase()
  const filtered = entries.filter(entry => {
    const isAppInstall = Boolean(entry.item)
    if (origin === 'app' && !isAppInstall) return false
    if (origin === 'external' && isAppInstall) return false
    if (!normalizedQuery) return true
    return `${entry.item?.title ?? entry.externalPublication?.item.title ?? ''} ${entry.item?.author ?? entry.externalPublication?.item.author ?? ''} ${entry.item?.fileName ?? entry.externalPublication?.item.fileName ?? ''} ${entry.folderName}`
      .toLocaleLowerCase()
      .includes(normalizedQuery)
  })

  return filtered.sort((a, b) => {
    if (order === 'largest') return b.sizeBytes - a.sizeBytes || a.folderName.localeCompare(b.folderName)
    if (order === 'smallest') return a.sizeBytes - b.sizeBytes || a.folderName.localeCompare(b.folderName)

    const aTime = Date.parse(a.installedAt)
    const bTime = Date.parse(b.installedAt)
    const aHasDate = Number.isFinite(aTime)
    const bHasDate = Number.isFinite(bTime)
    if (aHasDate !== bHasDate) return aHasDate ? -1 : 1
    if (!aHasDate || !bHasDate) return a.folderName.localeCompare(b.folderName)
    const dateOrder = order === 'recent' ? bTime - aTime : aTime - bTime
    return dateOrder || a.folderName.localeCompare(b.folderName)
  })
}

export function filterAndSortSoundPackages(
  packages: SoundPackage[],
  query: string,
  statusFilter: SoundDownloadStatusFilter,
  order: DownloadSortOrder,
  activePackageId: string | null,
): SoundPackage[] {
  const normalizedQuery = query.trim().toLocaleLowerCase()
  const filtered = packages.filter(packageInfo => {
    const isActive = packageInfo.id === activePackageId
    if (statusFilter === 'active' && !isActive) return false
    if (statusFilter === 'inactive' && isActive) return false
    if (!normalizedQuery) return true
    return `${packageInfo.title} ${packageInfo.author} ${packageInfo.archiveName}`
      .toLocaleLowerCase()
      .includes(normalizedQuery)
  })

  return filtered.sort((a, b) => {
    if (order === 'largest') return b.sizeBytes - a.sizeBytes || a.title.localeCompare(b.title)
    if (order === 'smallest') return a.sizeBytes - b.sizeBytes || a.title.localeCompare(b.title)
    const dateOrder = order === 'recent' ? b.downloadedAt - a.downloadedAt : a.downloadedAt - b.downloadedAt
    return dateOrder || a.title.localeCompare(b.title)
  })
}
