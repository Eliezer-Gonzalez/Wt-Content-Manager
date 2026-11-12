import { useCallback, useRef, useState } from 'react'
import type { SkinInstaller } from './useSkinInstaller'
import type { SoundLibraryController } from './useSoundLibrary'

type DownloadKind = 'skin' | 'sound'

type Props = {
  skinInstaller: SkinInstaller
  soundLibrary: SoundLibraryController
}

export function useDownloadCancellation({ skinInstaller, soundLibrary }: Props) {
  const pendingKindRef = useRef<DownloadKind | null>(null)
  const [pendingKind, setPendingKind] = useState<DownloadKind | null>(null)

  const requestSkinCancellation = useCallback(async () => {
    if (pendingKindRef.current) return
    pendingKindRef.current = 'skin'
    if (await skinInstaller.prepareCancel()) setPendingKind('skin')
    else pendingKindRef.current = null
  }, [skinInstaller.prepareCancel])

  const requestSoundCancellation = useCallback(async () => {
    if (pendingKindRef.current) return
    pendingKindRef.current = 'sound'
    if (await soundLibrary.prepareCancelDownload()) setPendingKind('sound')
    else pendingKindRef.current = null
  }, [soundLibrary.prepareCancelDownload])

  const continueDownload = useCallback(() => {
    const kind = pendingKindRef.current
    pendingKindRef.current = null
    setPendingKind(null)
    if (kind === 'skin') void skinInstaller.continueAfterCancelPrompt()
    if (kind === 'sound') void soundLibrary.continueAfterCancelPrompt()
  }, [skinInstaller.continueAfterCancelPrompt, soundLibrary.continueAfterCancelPrompt])

  const confirmCancellation = useCallback(() => {
    const kind = pendingKindRef.current
    pendingKindRef.current = null
    setPendingKind(null)
    if (kind === 'skin') void skinInstaller.cancel()
    if (kind === 'sound') void soundLibrary.cancelDownload()
  }, [skinInstaller.cancel, soundLibrary.cancelDownload])

  const dismissCancellation = useCallback(() => {
    const kind = pendingKindRef.current
    pendingKindRef.current = null
    setPendingKind(null)
    if (kind === 'skin') void skinInstaller.dismissCancelPrompt()
    if (kind === 'sound') void soundLibrary.dismissCancelPrompt()
  }, [skinInstaller.dismissCancelPrompt, soundLibrary.dismissCancelPrompt])

  return {
    pendingKind,
    requestSkinCancellation,
    requestSoundCancellation,
    continueDownload,
    confirmCancellation,
    dismissCancellation,
  }
}
