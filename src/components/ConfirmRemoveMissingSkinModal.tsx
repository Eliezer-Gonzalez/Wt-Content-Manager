import { useRef } from 'react'
import { Trash2 } from 'lucide-react'
import { Button } from './ui/Button'
import { useFocusTrap } from '../hooks/useFocusTrap'
import type { InstalledSkin } from '../lib/localLibrary'
import { useI18n } from '../i18n/I18nContext'

type Props = {
  entry: InstalledSkin | null
  onConfirm: () => void
  onClose: () => void
}

export function ConfirmRemoveMissingSkinModal({ entry, onConfirm, onClose }: Props) {
  const { t } = useI18n()
  const containerRef = useRef<HTMLDivElement>(null)
  const cancelRef = useRef<HTMLButtonElement>(null)

  useFocusTrap({
    containerRef,
    initialFocusRef: cancelRef,
    onClose,
    enabled: Boolean(entry),
    stopPropagationOnEscape: true,
  })

  if (!entry) return null

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/75 p-4 backdrop-blur-[2px]"
      onMouseDown={event => { if (event.target === event.currentTarget) onClose() }}
    >
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="remove-missing-skin-title"
        aria-describedby="remove-missing-skin-description"
        className="w-full max-w-md border border-[#3c4538] bg-[#1e241e] p-6 shadow-2xl"
        onKeyDown={event => { if (event.key === 'Enter') event.preventDefault() }}
      >
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center border border-[#644b42] bg-[#2a201d] text-[#e0c1b5]">
            <Trash2 size={18} aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 id="remove-missing-skin-title" className="font-display text-xl font-semibold leading-tight text-[#e6e7dd]">
              {t('removeMissingSkinTitle')}
            </h2>
            <p id="remove-missing-skin-description" className="mt-2 text-sm leading-relaxed text-[#b1b7ab]">
              {t('removeMissingSkinDescription', { folder: entry.folderName })}
            </p>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-end gap-2.5">
          <Button ref={cancelRef} variant="secondary" onClick={onClose}>
            {t('skinCancel')}
          </Button>
          <Button variant="danger" onClick={onConfirm}>
            <Trash2 size={14} aria-hidden="true" />
            <span>{t('removeMissingSkinConfirm')}</span>
          </Button>
        </div>
      </div>
    </div>
  )
}
