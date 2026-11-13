import { useEffect, useRef, useState } from 'react'
import { Check, X } from 'lucide-react'
import { useI18n } from '../i18n/I18nContext'
import { playCompletionChime, prepareCompletionChime } from '../lib/completionChime'
import { downloadCompletionEventName, type DownloadCompletionEvent } from '../lib/downloadCompletion'

const notificationDurationMs = 6000
const maxVisibleNotifications = 3

type Props = {
  showNotifications: boolean
  soundEnabled: boolean
  volume: number
}

export function DownloadCompletionNotifications({ showNotifications, soundEnabled, volume }: Props) {
  const { t } = useI18n()
  const [notifications, setNotifications] = useState<DownloadCompletionEvent[]>([])
  const [announcement, setAnnouncement] = useState<DownloadCompletionEvent | null>(null)
  const timersRef = useRef(new Map<number, number>())
  const preferencesRef = useRef({ showNotifications, soundEnabled, volume })
  preferencesRef.current = { showNotifications, soundEnabled, volume }

  useEffect(() => {
    if (showNotifications) return
    setNotifications([])
    setAnnouncement(null)
  }, [showNotifications])

  useEffect(() => {
    const onCompletion = (event: Event) => {
      const notice = (event as CustomEvent<DownloadCompletionEvent>).detail
      if (!notice || typeof notice.id !== 'number' || typeof notice.title !== 'string') return
      const preferences = preferencesRef.current
      if (preferences.soundEnabled) playCompletionChime(preferences.volume)
      if (!preferences.showNotifications) return
      setNotifications(current => [...current, notice].slice(-maxVisibleNotifications))
      setAnnouncement(notice)
      timersRef.current.set(notice.id, window.setTimeout(() => {
        timersRef.current.delete(notice.id)
        setNotifications(current => current.filter(item => item.id !== notice.id))
      }, notificationDurationMs))
    }
    const prepareAudio = () => prepareCompletionChime()
    window.addEventListener(downloadCompletionEventName, onCompletion)
    window.addEventListener('pointerdown', prepareAudio, { once: true })
    window.addEventListener('keydown', prepareAudio, { once: true })
    return () => {
      window.removeEventListener(downloadCompletionEventName, onCompletion)
      window.removeEventListener('pointerdown', prepareAudio)
      window.removeEventListener('keydown', prepareAudio)
      for (const timer of timersRef.current.values()) window.clearTimeout(timer)
      timersRef.current.clear()
    }
  }, [])

  function dismiss(id: number) {
    const timer = timersRef.current.get(id)
    if (timer != null) window.clearTimeout(timer)
    timersRef.current.delete(id)
    setNotifications(current => current.filter(item => item.id !== id))
  }

  const messageFor = (notice: DownloadCompletionEvent) => t(notice.kind === 'camouflage'
    ? 'downloadCompleteCamouflage'
    : notice.kind === 'sound-update'
      ? 'downloadCompleteSoundUpdate'
      : 'downloadCompleteSound', { title: notice.title })
  return (
    <>
      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        <span key={announcement?.id ?? 'empty'}>{announcement ? messageFor(announcement) : ''}</span>
      </div>
      {notifications.length > 0 && (
        <div className="pointer-events-none fixed bottom-4 right-4 z-[90] flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-2 max-[480px]:left-3 max-[480px]:right-3 max-[480px]:w-auto">
          {notifications.map(notice => (
            <section key={notice.id} role="group" aria-label={messageFor(notice)} className="pointer-events-auto flex min-w-0 items-start gap-3 border border-[#586b41] bg-[#202a1d] px-3 py-3 text-[#dce6ca] shadow-xl">
              <span className="grid size-8 shrink-0 place-items-center border border-[#6f8252] bg-[#293426] text-[#b4d882]">
                <Check size={16} aria-hidden="true" />
              </span>
              <p className="mb-0 min-w-0 flex-1 break-words text-sm leading-5">{messageFor(notice)}</p>
              <button type="button" className="grid size-8 shrink-0 place-items-center text-[#aab2a4] hover:bg-[#303a2d] hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-olive" onClick={() => dismiss(notice.id)} aria-label={t('dismissCompletionNotification')}>
                <X size={16} aria-hidden="true" />
              </button>
            </section>
          ))}
        </div>
      )}
    </>
  )
}
