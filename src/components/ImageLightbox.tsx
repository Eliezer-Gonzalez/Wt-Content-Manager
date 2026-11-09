import { useRef, useState } from 'react'
import type { KeyboardEvent, MouseEvent, PointerEvent } from 'react'
import { X, ZoomIn, ZoomOut } from 'lucide-react'
import { Button } from './ui/Button'
import { AppTooltip } from './ui/AppTooltip'
import { useFocusTrap } from '../hooks/useFocusTrap'
import { useI18n } from '../i18n/I18nProvider'

type Props = {
  src: string
  alt: string
  onClose: () => void
}

const PAN_STEP = 40

export function ImageLightbox({ src, alt, onClose }: Props) {
  const { t } = useI18n()
  const [zoomed, setZoomed] = useState(false)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [dragging, setDragging] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const viewerRef = useRef<HTMLDivElement>(null)
  const imageRef = useRef<HTMLImageElement>(null)
  const dragStartRef = useRef<{ pointerId: number; x: number; y: number; panX: number; panY: number } | null>(null)
  const draggedRef = useRef(false)

  useFocusTrap({
    containerRef,
    initialFocusRef: closeButtonRef,
    onClose,
    stopPropagationOnEscape: true,
  })

  function toggleImageZoom(event: MouseEvent<HTMLImageElement>) {
    event.stopPropagation()
    if (draggedRef.current) {
      draggedRef.current = false
      return
    }
    if (zoomed) setPan({ x: 0, y: 0 })
    setZoomed(value => !value)
  }

  function toggleButtonZoom(event: MouseEvent<HTMLButtonElement>) {
    event.stopPropagation()
    setPan({ x: 0, y: 0 })
    setZoomed(value => !value)
  }

  function startPan(event: PointerEvent<HTMLDivElement>) {
    if (!zoomed || event.target !== imageRef.current || event.button !== 0) return
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    dragStartRef.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, panX: pan.x, panY: pan.y }
    draggedRef.current = false
    setDragging(true)
  }

  function getMaxPan() {
    const viewer = viewerRef.current
    const image = imageRef.current
    if (!viewer || !image || !image.naturalWidth || !image.naturalHeight) return null
    const bounds = viewer.getBoundingClientRect()
    const fit = Math.min(bounds.width / image.naturalWidth, bounds.height / image.naturalHeight)
    const scaledWidth = image.naturalWidth * fit * 1.5
    const scaledHeight = image.naturalHeight * fit * 1.5
    return {
      maxX: Math.max(0, (scaledWidth - bounds.width) / 2),
      maxY: Math.max(0, (scaledHeight - bounds.height) / 2),
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (!zoomed) return
    const step = event.shiftKey ? PAN_STEP * 3 : PAN_STEP
    const direction = ({
      ArrowLeft: { x: step, y: 0 },
      ArrowRight: { x: -step, y: 0 },
      ArrowUp: { x: 0, y: step },
      ArrowDown: { x: 0, y: -step },
    } as Record<string, { x: number; y: number } | undefined>)[event.key]
    const max = getMaxPan()
    if (!direction || !max) return
    event.preventDefault()
    setPan(current => ({
      x: Math.max(-max.maxX, Math.min(max.maxX, current.x + direction.x)),
      y: Math.max(-max.maxY, Math.min(max.maxY, current.y + direction.y)),
    }))
  }

  function movePan(event: PointerEvent<HTMLDivElement>) {
    const start = dragStartRef.current
    const max = getMaxPan()
    if (!start || start.pointerId !== event.pointerId || !max) return

    const { maxX, maxY } = max
    const deltaX = event.clientX - start.x
    const deltaY = event.clientY - start.y
    if (Math.abs(deltaX) > 3 || Math.abs(deltaY) > 3) draggedRef.current = true
    setPan({
      x: Math.max(-maxX, Math.min(maxX, start.panX + deltaX)),
      y: Math.max(-maxY, Math.min(maxY, start.panY + deltaY)),
    })
  }

  function endPan(event: PointerEvent<HTMLDivElement>) {
    if (dragStartRef.current?.pointerId !== event.pointerId) return
    dragStartRef.current = null
    setDragging(false)
  }

  const zoomLabel = zoomed ? t('zoomOut') : t('zoomIn')

  return (
    <div
      ref={containerRef}
      className="fixed inset-x-0 bottom-0 top-9 z-[70] grid place-items-center bg-black/90 p-3"
      role="dialog"
      aria-modal="true"
      aria-label={alt}
      onKeyDown={handleKeyDown}
      onClick={event => {
        event.stopPropagation()
        onClose()
      }}
    >
      <Button
        ref={closeButtonRef}
        variant="icon"
        className="absolute right-4 top-4 z-10 size-11 border border-[#69715e] bg-[#171b17]"
        onClick={event => {
          event.stopPropagation()
          onClose()
        }}
        aria-label={t('close')}
      >
        <X size={20} />
      </Button>
      <div
        ref={viewerRef}
        className="group relative h-[min(80dvh,900px)] w-[min(88vw,1400px)] overflow-hidden"
        onClick={event => event.stopPropagation()}
        onPointerDown={startPan}
        onPointerMove={movePan}
        onPointerUp={endPan}
        onPointerCancel={endPan}
      >
        <img
          ref={imageRef}
          className={`size-full object-contain ${dragging ? 'cursor-grabbing' : zoomed ? 'cursor-grab' : 'cursor-zoom-in'} ${dragging ? '' : 'transition-transform duration-200 ease-out'}`}
          style={{
            transform: zoomed ? `translate(${pan.x}px, ${pan.y}px) scale(1.5)` : 'translate(0, 0) scale(1)',
            transformOrigin: 'center',
          }}
          src={src}
          alt={alt}
          draggable={false}
          onClick={toggleImageZoom}
        />
        <AppTooltip content={zoomLabel} className="absolute bottom-3 right-3 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100" align="end">
          <Button
            variant="icon"
            className="size-11 border border-[#69715e] bg-[#171b17]/90"
            onClick={toggleButtonZoom}
            aria-label={zoomLabel}
            aria-pressed={zoomed}
          >
            {zoomed ? <ZoomOut size={19} /> : <ZoomIn size={19} />}
          </Button>
        </AppTooltip>
      </div>
    </div>
  )
}
