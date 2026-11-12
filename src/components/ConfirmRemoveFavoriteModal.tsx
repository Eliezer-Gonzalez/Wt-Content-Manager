import { useRef } from 'react'
import { Bookmark, X } from 'lucide-react'
import { Button } from './ui/Button'
import { useFocusTrap } from '../hooks/useFocusTrap'
import type { WtLiveItem } from '../lib/wtLive'
import { useI18n } from '../i18n/I18nContext'

type Props = {
  item: WtLiveItem | null
  onConfirm: () => void
  onClose: () => void
}

export function ConfirmRemoveFavoriteModal({ item, onConfirm, onClose }: Props) {
  const { t } = useI18n()
  const containerRef = useRef<HTMLDivElement>(null)
  const cancelRef = useRef<HTMLButtonElement>(null)

  useFocusTrap({
    containerRef,
    initialFocusRef: cancelRef,
    onClose,
    enabled: Boolean(item),
    stopPropagationOnEscape: true,
  })

  if (!item) return null

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/75 p-4 backdrop-blur-[2px]"
      onMouseDown={event => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="remove-favorite-title"
        aria-describedby="remove-favorite-desc"
        className="w-full max-w-md border border-[#3c4538] bg-[#1e241e] p-6 shadow-2xl"
      >
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center border border-[#4d5945] bg-[#252c23] text-[#bdc99e]">
            <Bookmark size={18} aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 id="remove-favorite-title" className="font-display text-xl font-semibold leading-tight text-[#e6e7dd]">
              {t('favoriteRemoveConfirmTitle')}
            </h2>
            <p id="remove-favorite-desc" className="mt-2 text-sm leading-relaxed text-[#b1b7ab]">
              {t('favoriteRemoveConfirmBody', { title: item.title })}
            </p>
          </div>
          <Button variant="icon" size="sm" onClick={onClose} aria-label={t('close')}>
            <X size={16} aria-hidden="true" />
          </Button>
        </div>

        <div className="mt-6 flex items-center justify-end gap-2.5">
          <Button ref={cancelRef} variant="secondary" onClick={onClose}>
            {t('skinCancel')}
          </Button>
          <Button variant="danger" onClick={onConfirm}>
            <Bookmark size={14} aria-hidden="true" />
            {t('removeFavorite')}
          </Button>
        </div>
      </div>
    </div>
  )
}
