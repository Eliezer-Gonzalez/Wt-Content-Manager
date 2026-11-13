export type DownloadCompletionKind = 'camouflage' | 'sound' | 'sound-update'

export type DownloadCompletionEvent = {
  id: number
  kind: DownloadCompletionKind
  title: string
}

export const downloadCompletionEventName = 'wtcm:download-completed'
let nextEventId = 0

export function announceDownloadCompletion(kind: DownloadCompletionKind, title: string) {
  if (typeof window === 'undefined') return
  const detail: DownloadCompletionEvent = { id: ++nextEventId, kind, title: title.trim() }
  window.dispatchEvent(new CustomEvent(downloadCompletionEventName, { detail }))
}
