import { useEffect, useRef, useState, type RefObject } from 'react'
import { ArrowUp } from 'lucide-react'
import { useI18n } from '../i18n/I18nContext'
import { AppTooltip } from './ui/AppTooltip'

type Props = {
  enabled: boolean
  markerRef: RefObject<HTMLElement | null>
  scrollContainerRef: RefObject<HTMLElement | null> | null
}

export function BackToTopButton({ enabled, markerRef, scrollContainerRef }: Props) {
  const { t } = useI18n()
  const [visible, setVisible] = useState(false)
  const [mounted, setMounted] = useState(false)
  const exitTimerRef = useRef<number | null>(null)

  useEffect(() => {
    const marker = markerRef.current
    if (!enabled || !marker) {
      setVisible(false)
      return
    }

    const observer = new IntersectionObserver(
      ([entry]) => setVisible(!entry.isIntersecting),
      { root: scrollContainerRef?.current ?? null, threshold: 0 },
    )
    observer.observe(marker)
    return () => observer.disconnect()
  }, [enabled, markerRef, scrollContainerRef])

  useEffect(() => {
    if (exitTimerRef.current !== null) window.clearTimeout(exitTimerRef.current)
    if (visible) {
      setMounted(true)
      return
    }
    if (!mounted) return
    exitTimerRef.current = window.setTimeout(() => setMounted(false), 220)
    return () => {
      if (exitTimerRef.current !== null) window.clearTimeout(exitTimerRef.current)
      exitTimerRef.current = null
    }
  }, [visible, mounted])

  useEffect(() => () => {
    if (exitTimerRef.current !== null) window.clearTimeout(exitTimerRef.current)
  }, [])

  if (!mounted) return null

  function scrollToTop() {
    const behavior = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'
    if (scrollContainerRef?.current) scrollContainerRef.current.scrollTo({ top: 0, behavior })
    else window.scrollTo({ top: 0, behavior })
  }

  return (
    <AppTooltip content={t('backToTop')} className="fixed bottom-16 right-7 z-30 max-[720px]:bottom-14 max-[720px]:right-4" align="end">
      <button
        type="button"
        onClick={scrollToTop}
        aria-label={t('backToTop')}
        aria-hidden={!visible}
        tabIndex={visible ? 0 : -1}
        className={`${visible ? 'back-to-top-enter' : 'back-to-top-exit pointer-events-none'} grid size-11 place-items-center border border-[#78875d] bg-[#293027] text-[#e4ebd6] shadow-xl transition-colors hover:bg-[#3a4632] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#c1cba5]`}
      >
        <ArrowUp size={19} aria-hidden="true" />
      </button>
    </AppTooltip>
  )
}
