import { useRef, useState } from 'react'
import type { MouseEvent, PointerEvent } from 'react'
import { X, ZoomIn, ZoomOut } from 'lucide-react'
import { Button } from './ui/Button'
import { useFocusTrap } from '../hooks/useFocusTrap'

type Props = {
  src: string
  alt: string
  closeLabel: string
  zoomInLabel: string
  zoomOutLabel: string
  onClose: () => void
}

export function ImageLightbox({ src, alt, closeLabel, zoomInLabel, zoomOutLabel, onClose }: Props) {
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

  function movePan(event: PointerEvent<HTMLDivElement>) {
    const start = dragStartRef.current
    const viewer = viewerRef.current
    const image = imageRef.current
    if (!start || start.pointerId !== event.pointerId || !viewer || !image || !image.naturalWidth || !image.naturalHeight) return

    const bounds = viewer.getBoundingClientRect()
    const fit = Math.min(bounds.width / image.naturalWidth, bounds.height / image.naturalHeight)
    const scaledWidth = image.naturalWidth * fit * 1.5
    const scaledHeight = image.naturalHeight * fit * 1.5
    const maxX = Math.max(0, (scaledWidth - bounds.width) / 2)
    const maxY = Math.max(0, (scaledHeight - bounds.height) / 2)
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

  return (
    <div
      ref={containerRef}
      className="fixed inset-x-0 bottom-0 top-9 z-[70] grid place-items-center bg-black/90 p-3"
      role="dialog"
      aria-modal="true"
      aria-label={alt}
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
        aria-label={closeLabel}
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
        <Button
          variant="icon"
          className="absolute bottom-3 right-3 size-11 border border-[#69715e] bg-[#171b17]/90 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
          onClick={toggleButtonZoom}
          aria-label={zoomed ? zoomOutLabel : zoomInLabel}
          aria-pressed={zoomed}
          title={zoomed ? zoomOutLabel : zoomInLabel}
        >
          {zoomed ? <ZoomOut size={19} /> : <ZoomIn size={19} />}
        </Button>
      </div>
    </div>
  )
}
