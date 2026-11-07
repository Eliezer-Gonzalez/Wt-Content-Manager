import { useState, type ReactNode } from 'react'
import { Button } from './ui/Button'
import { useAutoLoadMore } from '../hooks/useAutoLoadMore'
import { useI18n } from '../i18n/I18nProvider'

type Props<T> = {
  items: T[]
  resetKey: string
  gridClassName: string
  getKey: (item: T) => string
  renderItem: (item: T) => ReactNode
}

const pageSize = 24
const autoLoadCap = pageSize * 6

export function PaginatedGrid<T>({ items, resetKey, gridClassName, getKey, renderItem }: Props<T>) {
  const { t } = useI18n()
  const [pagination, setPagination] = useState({ page: 1, resetKey })
  // Reset to the first page during render when resetKey changes (avoids an extra effect pass).
  const page = pagination.resetKey === resetKey ? pagination.page : 1
  const visible = items.slice(0, page * pageSize)
  const hasMore = visible.length < items.length
  const loadMoreRef = useAutoLoadMore({
    enabled: hasMore && visible.length % autoLoadCap !== 0,
    onLoadMore: () => setPagination({ page: page + 1, resetKey }),
  })
  return <>
    <div className={gridClassName}>{visible.map(item => <div key={getKey(item)}>{renderItem(item)}</div>)}</div>
    {hasMore && (
      <div ref={loadMoreRef} className="mt-5 flex justify-center">
        <Button variant="secondary" onClick={() => setPagination({ page: page + 1, resetKey })}>
          {t('showMore')}
        </Button>
      </div>
    )}
  </>
}
