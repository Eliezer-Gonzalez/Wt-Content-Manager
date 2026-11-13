import { useCallback, useMemo } from 'react'
import { useSkinInstaller } from './useSkinInstaller'
import type { useLocalLibrary } from './useLocalLibrary'
import type { TranslateFn } from '../i18n/I18nProvider'
import type { WtLiveItem } from '../lib/wtLive'

type Options = {
  gamePath?: string
  t: TranslateFn
  library: ReturnType<typeof useLocalLibrary>
}

export function useCamouflageManagement({ gamePath, t, library }: Options) {
  const externalFolderNames = useMemo(
    () => library.installedSkins.filter(entry => !entry.item).map(entry => entry.folderName),
    [library.installedSkins],
  )
  const recordExternalLink = useCallback((item: WtLiveItem, _folderName: string, path: string) => {
    library.linkExternalPublication(path, item)
  }, [library.linkExternalPublication])
  const skinInstaller = useSkinInstaller({
    gamePath,
    t,
    onInstalled: library.recordInstallation,
    externalFolderNames,
    onLinkedExternal: recordExternalLink,
  })
  const installedIds = useMemo(() => new Set(library.installedSkins.flatMap(entry => {
    const id = entry.item?.id ?? entry.externalPublication?.item.id
    return id != null ? [id] : []
  })), [library.installedSkins])

  return { skinInstaller, installedIds }
}
