import { useEffect, useMemo, useState, type ReactNode } from 'react'
import type { WtLiveItem } from '../lib/wtLive'

type Props = { items: WtLiveItem[]; renderItem: (item: WtLiveItem) => ReactNode }

function getColumnCount(width: number): number {
  if (width >= 1900) return 5
  if (width >= 1500) return 4
  if (width >= 1100) return 3
  if (width >= 600) return 2
  return 1
}

export function MasonryPostGrid({ items, renderItem }: Props) {
  const [columnCount, setColumnCount] = useState(() =>
    typeof window !== 'undefined' ? getColumnCount(window.innerWidth) : 3,
  )

  useEffect(() => {
    const updateColumns = () => setColumnCount(getColumnCount(window.innerWidth))
    updateColumns()
    window.addEventListener('resize', updateColumns)
    return () => window.removeEventListener('resize', updateColumns)
  }, [])

  const columns = useMemo(() => {
    const cols: WtLiveItem[][] = Array.from({ length: columnCount }, () => [])
    const heights = new Array<number>(columnCount).fill(0)

    for (const item of items) {
      let shortestIndex = 0
      for (let i = 1; i < columnCount; i++) {
        if (heights[i] < heights[shortestIndex]) {
          shortestIndex = i
        }
      }
      cols[shortestIndex].push(item)
      const clampedRatio = Math.max(0.45, Math.min(2.5, item.imageAspectRatio ?? 1.6))
      heights[shortestIndex] += 1 / clampedRatio + 0.45
    }

    return cols
  }, [items, columnCount])

  return (
    <div
      className="grid gap-3"
      style={{ gridTemplateColumns: `repeat(${columnCount}, minmax(0, 1fr))` }}
    >
      {columns.map((colItems, colIndex) => (
        <div key={colIndex} className="flex min-w-0 flex-col gap-3">
          {colItems.map(item => (
            <div key={item.id} className="min-w-0">
              {renderItem(item)}
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}
