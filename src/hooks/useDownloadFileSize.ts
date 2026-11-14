import { useEffect, useRef, useState } from 'react'
import { getDownloadFileSize } from '../lib/downloadSize'

type SizeResult = { url: string; bytes: number | null }

export function useDownloadFileSize(url?: string, knownSize?: number, eager = false) {
  const visibilityRef = useRef<HTMLElement | null>(null)
  const [requestedUrl, setRequestedUrl] = useState<string | null>(() => eager && url ? url : null)
  const [result, setResult] = useState<SizeResult | null>(null)

  useEffect(() => {
    if (!url || knownSize != null) return
    if (eager) {
      setRequestedUrl(url)
      return
    }

    const target = visibilityRef.current
    if (!target || typeof IntersectionObserver === 'undefined') {
      setRequestedUrl(url)
      return
    }

    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) {
        setRequestedUrl(url)
        observer.disconnect()
      }
    }, { rootMargin: '280px' })
    observer.observe(target)
    return () => observer.disconnect()
  }, [eager, knownSize, url])

  useEffect(() => {
    if (!url || knownSize != null || requestedUrl !== url) return
    let active = true
    void getDownloadFileSize(url).then(bytes => {
      if (active) setResult({ url, bytes })
    })
    return () => { active = false }
  }, [knownSize, requestedUrl, url])

  const sizeBytes = knownSize ?? (result && result.url === url ? result.bytes ?? undefined : undefined)
  return { visibilityRef, sizeBytes }
}
