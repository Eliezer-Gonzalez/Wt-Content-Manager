import { useEffect, useState, type ReactNode } from 'react'
import type { TranslateFn } from '../i18n/I18nProvider'

type Props<T> = {
  items: T[]
  resetKey: string
  gridClassName: string
  t: TranslateFn
  getKey: (item: T) => string
  renderItem: (item: T) => ReactNode
}

const pageSize = 24

export function PaginatedGrid<T>({ items, resetKey, gridClassName, t, getKey, renderItem }: Props<T>) {
  const [page, setPage] = useState(1)
  useEffect(() => setPage(1), [resetKey])
  const visible = items.slice(0, page * pageSize)
  return <>
    <div className={gridClassName}>{visible.map(item => <div key={getKey(item)}>{renderItem(item)}</div>)}</div>
    {visible.length < items.length && (
      <div className="mt-5 flex justify-center">
        <button
          type="button"
          className="min-h-10 border border-[#414a39] bg-[#252b24] px-4 text-sm text-[#c3cbb6] transition-colors hover:border-[#77845d] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#87976a]"
          onClick={() => setPage(current => current + 1)}
        >
          {t('showMore')}
        </button>
      </div>
    )}
  </>
}
