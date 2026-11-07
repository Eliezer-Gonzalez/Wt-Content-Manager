import type { ReactNode } from 'react'
import type { WtLiveItem } from '../wtLive'

type Props = { items: WtLiveItem[]; renderItem: (item: WtLiveItem) => ReactNode }

export function MasonryPostGrid({ items, renderItem }: Props) {
  return <div className="columns-1 gap-3 min-[600px]:columns-2 min-[1100px]:columns-3 min-[1500px]:columns-4 min-[1900px]:columns-5">
    {items.map(item => <div key={item.id} className="mb-3 break-inside-avoid">{renderItem(item)}</div>)}
  </div>
}
