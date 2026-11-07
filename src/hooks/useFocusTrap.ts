import { useEffect, type RefObject } from 'react'

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

export type UseFocusTrapOptions = {
  containerRef: RefObject<HTMLElement | null>
  initialFocusRef: RefObject<HTMLElement | null>
  onClose?: () => void
  enabled?: boolean
  canEscape?: boolean
  stopPropagationOnEscape?: boolean
}

export function useFocusTrap({
  containerRef,
  initialFocusRef,
  onClose,
  enabled = true,
  canEscape = true,
  stopPropagationOnEscape = false,
}: UseFocusTrapOptions) {
  useEffect(() => {
    if (!enabled) return

    const previousActiveElement = document.activeElement as HTMLElement | null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    initialFocusRef.current?.focus()

    return () => {
      document.body.style.overflow = previousOverflow
      previousActiveElement?.focus()
    }
  }, [enabled, initialFocusRef])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!enabled) return

      if (event.key === 'Escape') {
        if (stopPropagationOnEscape) event.stopImmediatePropagation()
        if (canEscape && onClose) {
          if (!stopPropagationOnEscape) event.preventDefault()
          onClose()
        }
        return
      }

      if (event.key === 'Tab') {
        const container = containerRef.current
        if (!container) return

        const focusable = Array.from(
          container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
        ).filter(el => el.offsetParent !== null || el.offsetWidth > 0 || el.offsetHeight > 0)

        if (focusable.length === 0) {
          event.preventDefault()
          return
        }

        const first = focusable[0]
        const last = focusable[focusable.length - 1]

        if (event.shiftKey) {
          if (document.activeElement === first || !container.contains(document.activeElement)) {
            event.preventDefault()
            last.focus()
          }
        } else {
          if (document.activeElement === last || !container.contains(document.activeElement)) {
            event.preventDefault()
            first.focus()
          }
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [canEscape, containerRef, enabled, onClose, stopPropagationOnEscape])
}
