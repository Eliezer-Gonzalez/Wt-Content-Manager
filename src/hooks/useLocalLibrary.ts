import { useCallback, useEffect, useRef, useState } from 'react'
import { isTauriRuntime } from '../lib/gameInstall'
import { emptyLocalLibrary, exportLocalLibrary, linkExternalSkinPublication, mergeImportedLocalLibrary, mergeRecoveryReviewRecords, mergeScannedSkins, parseLocalLibraryExport, removeExternalSkinPublication, removeMissingSkinRecord, sameFavorite, sameSkinIdentity, unlinkExternalSkinPublication, upsertExternalSkinPublication, type InstalledSkin, type LocalLibrary } from '../lib/localLibrary'
import { loadPersistentLocalLibrary, savePersistentLocalLibrary } from '../lib/localLibraryPersistence'
import { scanInstalledSkins, uninstallSkin } from '../lib/skins'
import { waitForMinimumLoadingDuration } from '../lib/minimumLoadingDuration'
import { formatAppError } from '../lib/appError'
import type { TranslateFn } from '../i18n/I18nProvider'
import type { WtLiveItem } from '../lib/wtLive'

export function useLocalLibrary(gamePath?: string, t?: TranslateFn) {
  const [library, setLibrary] = useState<LocalLibrary>(emptyLocalLibrary)
  const libraryRef = useRef(library)
  const [ready, setReady] = useState(false)
  const [loadError, setLoadError] = useState(false)
  const [persistenceError, setPersistenceError] = useState(false)
  const [loadAttempt, setLoadAttempt] = useState(0)
  const [scanning, setScanning] = useState(false)
  const [uninstallTarget, setUninstallTarget] = useState<InstalledSkin | null>(null)
  const [skinRecordToRemove, setSkinRecordToRemove] = useState<InstalledSkin | null>(null)
  const [uninstalling, setUninstalling] = useState(false)
  const [uninstallError, setUninstallError] = useState('')
  const [uninstalledFolder, setUninstalledFolder] = useState<string | null>(null)

  const updateLibrary = useCallback((update: (current: LocalLibrary) => LocalLibrary) => {
    const current = libraryRef.current
    const updated = update(current)
    const next = { ...updated, repairRevision: current.repairRevision ?? 0 }
    libraryRef.current = next
    setLibrary(next)
  }, [])

  const replaceLibrary = useCallback((next: LocalLibrary) => {
    libraryRef.current = next
    setLibrary(next)
  }, [])

  useEffect(() => {
    let active = true
    setReady(false)
    setLoadError(false)
    void loadPersistentLocalLibrary().then(saved => {
      if (!active) return
      libraryRef.current = saved
      setLibrary(saved)
      setReady(true)
    }).catch(() => {
      if (active) setLoadError(true)
    })
    return () => { active = false }
  }, [loadAttempt])

  useEffect(() => {
    if (!ready) return
    let active = true
    void savePersistentLocalLibrary(libraryRef.current).then(() => {
      if (active) setPersistenceError(false)
    }).catch(() => {
      if (active) setPersistenceError(true)
    })
    return () => { active = false }
  }, [library, ready])

  useEffect(() => {
    if (!uninstalledFolder) return
    const timer = window.setTimeout(() => setUninstalledFolder(null), 5500)
    return () => window.clearTimeout(timer)
  }, [uninstalledFolder])

  const dismissUninstalledNotice = useCallback(() => setUninstalledFolder(null), [])

  const retryLibraryLoad = useCallback(() => setLoadAttempt(attempt => attempt + 1), [])
  const exportLibrary = useCallback(() => exportLocalLibrary(library), [library])

  const importLibrary = useCallback(async (value: unknown): Promise<unknown> => {
    const imported = parseLocalLibraryExport(value)
    const importedFolders = new Set([
      ...imported.installedSkins.filter(entry => entry.item || entry.externalPublication).map(entry => entry.folderName.toLowerCase()),
      ...imported.externalSkinPublications.map(link => link.folderPath.replace(/[\\/]+$/, '').split(/[\\/]/).pop()?.toLowerCase() ?? ''),
    ])
    const matchedFolders = libraryRef.current.installedSkins.filter(entry => importedFolders.has(entry.folderName.toLowerCase()))
    let base = libraryRef.current
    let next: LocalLibrary
    while (true) {
      next = mergeImportedLocalLibrary(base, imported)
      await savePersistentLocalLibrary(next)
      const latest = libraryRef.current
      if (latest === base) break
      base = latest
    }
    libraryRef.current = next
    setLibrary(next)
    setPersistenceError(false)
    return matchedFolders.length
  }, [])

  const rescanSkins = useCallback(async () => {
    if (!isTauriRuntime || !gamePath || !ready) return
    const startedAt = Date.now()
    setScanning(true)
    try {
      const scanned = await scanInstalledSkins(gamePath)
      const recovered = await loadPersistentLocalLibrary()
      updateLibrary(current => {
        const latest = mergeRecoveryReviewRecords(current, recovered)
        return {
          ...latest,
          installedSkins: mergeScannedSkins(scanned, latest.installedSkins, latest.externalSkinPublications),
        }
      })
    } catch {
      /* Keep current installed list if scan fails. */
    } finally {
      await waitForMinimumLoadingDuration(startedAt)
      setScanning(false)
    }
  }, [gamePath, ready, updateLibrary])

  const refreshRecoveryRecords = useCallback(async () => {
    const recovered = await loadPersistentLocalLibrary()
    updateLibrary(current => mergeRecoveryReviewRecords(current, recovered))
  }, [updateLibrary])

  useEffect(() => {
    void rescanSkins()
  }, [rescanSkins])

  const toggleFavorite = useCallback((item: WtLiveItem) => {
    updateLibrary(current => {
      const favorite = { ...item, contentType: item.contentType ?? 'camouflage' }
      const favorites = current.favorites.some(saved => sameFavorite(saved, favorite))
        ? current.favorites.filter(saved => !sameFavorite(saved, favorite))
        : [favorite, ...current.favorites]
      return { ...current, favorites }
    })
  }, [updateLibrary])

  const recordInstallation = useCallback((item: WtLiveItem, result: Omit<InstalledSkin, 'availability' | 'item' | 'installedAt'>) => {
    const entry: InstalledSkin = { ...result, recordId: crypto.randomUUID(), availability: 'present', item, installedAt: new Date().toISOString() }
    updateLibrary(current => ({
      ...current,
      installedSkins: [entry, ...current.installedSkins.filter(s => !sameSkinIdentity(s, entry))],
      externalSkinPublications: removeExternalSkinPublication(current.externalSkinPublications, entry.path),
    }))
  }, [updateLibrary])

  const linkExternalPublication = useCallback((folderPath: string, item: WtLiveItem) => {
    updateLibrary(current => ({
      ...current,
      installedSkins: linkExternalSkinPublication(current.installedSkins, folderPath, item),
      externalSkinPublications: upsertExternalSkinPublication(current.externalSkinPublications, folderPath, item),
    }))
  }, [updateLibrary])

  const unlinkExternalPublication = useCallback((folderPath: string) => {
    updateLibrary(current => ({
      ...current,
      installedSkins: unlinkExternalSkinPublication(current.installedSkins, folderPath),
      externalSkinPublications: removeExternalSkinPublication(current.externalSkinPublications, folderPath),
    }))
  }, [updateLibrary])

  const uninstallInstalledSkin = useCallback(async (entry: InstalledSkin) => {
    if (isTauriRuntime && gamePath) {
      await uninstallSkin(gamePath, entry.folderName)
    }
    updateLibrary(current => ({
      ...current,
      installedSkins: current.installedSkins.filter(s => !sameSkinIdentity(s, entry)),
      externalSkinPublications: removeExternalSkinPublication(current.externalSkinPublications, entry.path),
    }))
  }, [gamePath, updateLibrary])

  const requestUninstall = useCallback((entry: InstalledSkin) => {
    setUninstallError('')
    setUninstallTarget(entry)
  }, [])

  const cancelUninstall = useCallback(() => {
    if (uninstalling) return
    setUninstallTarget(null)
    setUninstallError('')
  }, [uninstalling])

  const requestRemoveMissingSkin = useCallback((entry: InstalledSkin) => {
    if (entry.availability === 'missing') setSkinRecordToRemove(entry)
  }, [])

  const cancelRemoveMissingSkin = useCallback(() => setSkinRecordToRemove(null), [])

  const confirmRemoveMissingSkin = useCallback(() => {
    const target = skinRecordToRemove
    if (!target) return
    updateLibrary(current => {
      const currentEntry = current.installedSkins.find(entry => sameSkinIdentity(entry, target))
      return currentEntry?.availability === 'missing' ? removeMissingSkinRecord(current, currentEntry) : current
    })
    setSkinRecordToRemove(null)
  }, [skinRecordToRemove, updateLibrary])

  const confirmUninstall = useCallback(async () => {
    if (!uninstallTarget || uninstalling) return
    const target = uninstallTarget
    setUninstalling(true)
    setUninstallError('')
    try {
      await uninstallInstalledSkin(target)
      setUninstallTarget(null)
      setUninstalledFolder(target.folderName)
    } catch (cause) {
      if (t) {
        const formatted = formatAppError(cause, t)
        setUninstallError(formatted.detail ? `${formatted.message} (${formatted.detail})` : formatted.message)
      } else {
        setUninstallError(cause instanceof Error ? cause.message : String(cause))
      }
    } finally {
      setUninstalling(false)
    }
  }, [t, uninstallInstalledSkin, uninstallTarget, uninstalling])

  return {
    favorites: library.favorites,
    installedSkins: library.installedSkins,
    exportLibrary,
    library,
    ready,
    loadError,
    persistenceError,
    retryLibraryLoad,
    importLibrary,
    replaceLibrary,
    scanning,
    rescanSkins,
    refreshRecoveryRecords,
    toggleFavorite,
    recordInstallation,
    linkExternalPublication,
    unlinkExternalPublication,
    uninstallInstalledSkin,
    uninstallTarget,
    skinRecordToRemove,
    uninstalling,
    uninstallError,
    uninstalledFolder,
    dismissUninstalledNotice,
    requestUninstall,
    cancelUninstall,
    confirmUninstall,
    requestRemoveMissingSkin,
    cancelRemoveMissingSkin,
    confirmRemoveMissingSkin,
  }
}

