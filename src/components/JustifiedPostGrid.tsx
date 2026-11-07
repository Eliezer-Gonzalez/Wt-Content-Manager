import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { WtLiveItem } from '../wtLive'

type Row = { items: WtLiveItem[]; widths: number[]; imageHeight: number }
type Props = {
  items: WtLiveItem[]
  renderItem: (item: WtLiveItem, imageHeight: number, onImageRatio: (ratio: number) => void) => ReactNode
}

const gap = 12
const targetImageHeight = 190
const minImageHeight = 160
const maxImageHeight = 270
const minCardWidth = 220

function aspectRatio(item: WtLiveItem): number {
  const value = item.imageAspectRatio ?? 1.65
  return Number.isFinite(value) && value > 0 ? Math.min(2.5, Math.max(0.55, value)) : 1.65
}

function rowWidthAtHeight(items: WtLiveItem[], height: number): number {
  return items.reduce((sum, item) => sum + Math.max(minCardWidth, aspectRatio(item) * height), 0) + gap * Math.max(0, items.length - 1)
}

function cardWidths(items: WtLiveItem[], height: number, containerWidth: number): number[] {
  const widths = items.map(item => Math.max(minCardWidth, aspectRatio(item) * height))
  const gapsWidth = gap * Math.max(0, items.length - 1)
  const totalWidth = widths.reduce((sum, width) => sum + width, 0) + gapsWidth
  if (totalWidth <= containerWidth) return widths
  const availableWidth = Math.max(1, containerWidth - gapsWidth)
  const scale = availableWidth / widths.reduce((sum, width) => sum + width, 0)
  return widths.map(width => width * scale)
}

function makeRow(items: WtLiveItem[], width: number, justify: boolean): Row {
  const imagesWidth = Math.max(1, width - gap * Math.max(0, items.length - 1))
  const ratioTotal = items.reduce((sum, item) => sum + aspectRatio(item), 0)
  const naturalHeight = imagesWidth / ratioTotal
  const targetRowWidth = rowWidthAtHeight(items, targetImageHeight)
  const fillRow = justify || (items.length > 1 && targetRowWidth >= width * 0.75)
  const imageHeight = fillRow
    ? Math.min(maxImageHeight, Math.max(minImageHeight, naturalHeight))
    : targetImageHeight

  return { items, widths: cardWidths(items, imageHeight, width), imageHeight }
}

function buildRows(items: WtLiveItem[], width: number): Row[] {
  if (width <= 0) return []
  const rows: Row[] = []
  let current: WtLiveItem[] = []

  for (const item of items) {
    const candidate = [...current, item]
    const candidateWidth = rowWidthAtHeight(candidate, targetImageHeight)

    if (current.length > 0 && candidateWidth > width) {
      rows.push(makeRow(current, width, true))
      current = [item]
    } else {
      current = candidate
    }
  }

  if (current.length > 0) rows.push(makeRow(current, width, false))
  return rows
}

export function JustifiedPostGrid({ items, renderItem }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)
  const [measuredRatios, setMeasuredRatios] = useState<Record<number, number>>({})
  const layoutItems = useMemo(() => items.map(item => ({
    ...item,
    imageAspectRatio: measuredRatios[item.id] ?? item.imageAspectRatio,
  })), [items, measuredRatios])
  const rows = useMemo(() => buildRows(layoutItems, width), [layoutItems, width])

  function rememberImageRatio(id: number, ratio: number) {
    if (!Number.isFinite(ratio) || ratio <= 0) return
    setMeasuredRatios(current => {
      const previous = current[id]
      return previous && Math.abs(previous - ratio) < 0.015 ? current : { ...current, [id]: ratio }
    })
  }

  useEffect(() => {
    const element = containerRef.current
    if (!element) return
    const observer = new ResizeObserver(([entry]) => {
      const nextWidth = Math.round(entry.contentRect.width)
      setWidth(current => current === nextWidth ? current : nextWidth)
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  return <div ref={containerRef} className="w-full min-w-0 space-y-3 overflow-x-hidden">
    {rows.map(row => <div key={row.items[0]?.id} className="flex w-full min-w-0 items-stretch justify-center gap-3">
      {row.items.map((item, index) => <div key={item.id} className="min-w-0 shrink-0" style={{ width: row.widths[index], flexBasis: row.widths[index] }}>
        {renderItem(item, row.imageHeight, ratio => rememberImageRatio(item.id, ratio))}
      </div>)}
    </div>)}
  </div>
}
