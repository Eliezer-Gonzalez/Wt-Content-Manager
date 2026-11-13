import { useCallback, useEffect, useState } from 'react'
import { isTauriRuntime } from '../lib/gameInstall'
import { linkExternalSkinPublication, loadLocalLibrary, mergeScannedSkins, removeExternalSkinPublication, sameFavorite, saveLocalLibrary, unlinkExternalSkinPublication, upsertExternalSkinPublication, type InstalledSkin, type LocalLibrary } from '../lib/localLibrary'
import { scanInstalledSkins, uninstallSkin } from '../lib/skins'
import { waitForMinimumLoadingDuration } from '../lib/minimumLoadingDuration'
import { formatAppError } from '../lib/appError'
import type { TranslateFn } from '../i18n/I18nProvider'
import type { WtLiveItem } from '../lib/wtLive'

export function useLocalLibrary(gamePath?: string, t?: TranslateFn) {
  const [library, setLibrary] = useState<LocalLibrary>(loadLocalLibrary)
  const [scanning, setScanning] = useState(false)
  const [uninstallTarget, setUninstallTarget] = useState<InstalledSkin | null>(null)
  const [uninstalling, setUninstalling] = useState(false)
  const [uninstallError, setUninstallError] = useState('')
  const [uninstalledFolder, setUninstalledFolder] = useState<string | null>(null)

  useEffect(() => saveLocalLibrary(library), [library])

  useEffect(() => {
    if (!uninstalledFolder) return
    const timer = window.setTimeout(() => setUninstalledFolder(null), 5500)
    return () => window.clearTimeout(timer)
  }, [uninstalledFolder])

  const dismissUninstalledNotice = useCallback(() => setUninstalledFolder(null), [])

  const rescanSkins = useCallback(async () => {
    if (!isTauriRuntime || !gamePath) return
    const startedAt = Date.now()
    setScanning(true)
    try {
      const scanned = await scanInstalledSkins(gamePath)
      setLibrary(current => ({
        ...current,
        installedSkins: mergeScannedSkins(scanned, current.installedSkins, current.externalSkinPublications),
      }))
    } catch {
      /* Keep current installed list if scan fails. */
    } finally {
      await waitForMinimumLoadingDuration(startedAt)
      setScanning(false)
    }
  }, [gamePath])

  useEffect(() => {
    void rescanSkins()
  }, [rescanSkins])

  const toggleFavorite = useCallback((item: WtLiveItem) => {
    setLibrary(current => {
      const favorite = { ...item, contentType: item.contentType ?? 'camouflage' }
      const favorites = current.favorites.some(saved => sameFavorite(saved, favorite))
        ? current.favorites.filter(saved => !sameFavorite(saved, favorite))
        : [favorite, ...current.favorites]
      return { ...current, favorites }
    })
  }, [])

  const recordInstallation = useCallback((item: WtLiveItem, result: Omit<InstalledSkin, 'item' | 'installedAt'>) => {
    const entry: InstalledSkin = { ...result, item, installedAt: new Date().toISOString() }
    setLibrary(current => ({
      ...current,
      installedSkins: [entry, ...current.installedSkins.filter(s => s.folderName.toLowerCase() !== entry.folderName.toLowerCase())],
      externalSkinPublications: removeExternalSkinPublication(current.externalSkinPublications, entry.path),
    }))
  }, [])

  const linkExternalPublication = useCallback((folderPath: string, item: WtLiveItem) => {
    setLibrary(current => ({
      ...current,
      installedSkins: linkExternalSkinPublication(current.installedSkins, folderPath, item),
      externalSkinPublications: upsertExternalSkinPublication(current.externalSkinPublications, folderPath, item),
    }))
  }, [])

  const unlinkExternalPublication = useCallback((folderPath: string) => {
    setLibrary(current => ({
      ...current,
      installedSkins: unlinkExternalSkinPublication(current.installedSkins, folderPath),
      externalSkinPublications: removeExternalSkinPublication(current.externalSkinPublications, folderPath),
    }))
  }, [])

  const uninstallInstalledSkin = useCallback(async (entry: InstalledSkin) => {
    if (isTauriRuntime && gamePath) {
      await uninstallSkin(gamePath, entry.folderName)
    }
    setLibrary(current => ({
      ...current,
      installedSkins: current.installedSkins.filter(s => s.folderName.toLowerCase() !== entry.folderName.toLowerCase()),
      externalSkinPublications: removeExternalSkinPublication(current.externalSkinPublications, entry.path),
    }))
  }, [gamePath])

  const requestUninstall = useCallback((entry: InstalledSkin) => {
    setUninstallError('')
    setUninstallTarget(entry)
  }, [])

  const cancelUninstall = useCallback(() => {
    if (uninstalling) return
    setUninstallTarget(null)
    setUninstallError('')
  }, [uninstalling])

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
    scanning,
    rescanSkins,
    toggleFavorite,
    recordInstallation,
    linkExternalPublication,
    unlinkExternalPublication,
    uninstallInstalledSkin,
    uninstallTarget,
    uninstalling,
    uninstallError,
    uninstalledFolder,
    dismissUninstalledNotice,
    requestUninstall,
    cancelUninstall,
    confirmUninstall,
  }
}

