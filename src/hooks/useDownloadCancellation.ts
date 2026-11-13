import { useCallback, useRef, useState } from 'react'
import type { SkinInstaller } from './useSkinInstaller'
import type { SoundLibraryController } from './useSoundLibrary'

type DownloadKind = 'skin' | 'sound' | 'sound-update'

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

  const requestSoundUpdateCancellation = useCallback(async () => {
    if (pendingKindRef.current) return
    pendingKindRef.current = 'sound-update'
    if (await soundLibrary.prepareCancelUpdate()) setPendingKind('sound')
    else pendingKindRef.current = null
  }, [soundLibrary.prepareCancelUpdate])

  const continueDownload = useCallback(() => {
    const kind = pendingKindRef.current
    pendingKindRef.current = null
    setPendingKind(null)
    if (kind === 'skin') void skinInstaller.continueAfterCancelPrompt()
    if (kind === 'sound') void soundLibrary.continueAfterCancelPrompt()
    if (kind === 'sound-update') void soundLibrary.continueAfterUpdateCancelPrompt()
  }, [skinInstaller.continueAfterCancelPrompt, soundLibrary.continueAfterCancelPrompt, soundLibrary.continueAfterUpdateCancelPrompt])

  const confirmCancellation = useCallback(() => {
    const kind = pendingKindRef.current
    pendingKindRef.current = null
    setPendingKind(null)
    if (kind === 'skin') void skinInstaller.cancel()
    if (kind === 'sound') void soundLibrary.cancelDownload()
    if (kind === 'sound-update') void soundLibrary.cancelUpdate()
  }, [skinInstaller.cancel, soundLibrary.cancelDownload, soundLibrary.cancelUpdate])

  const dismissCancellation = useCallback(() => {
    const kind = pendingKindRef.current
    pendingKindRef.current = null
    setPendingKind(null)
    if (kind === 'skin') void skinInstaller.dismissCancelPrompt()
    if (kind === 'sound') void soundLibrary.dismissCancelPrompt()
    if (kind === 'sound-update') void soundLibrary.dismissUpdateCancelPrompt()
  }, [skinInstaller.dismissCancelPrompt, soundLibrary.dismissCancelPrompt, soundLibrary.dismissUpdateCancelPrompt])

  return {
    pendingKind,
    requestSkinCancellation,
    requestSoundCancellation,
    requestSoundUpdateCancellation,
    continueDownload,
    confirmCancellation,
    dismissCancellation,
  }
}
