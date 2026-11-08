import { useRef } from 'react'
import { Broom, X } from 'lucide-react'
import { useFocusTrap } from '../hooks/useFocusTrap'
import { useI18n } from '../i18n/I18nProvider'
import { formatFileSize } from '../lib/format'
import { Button } from './ui/Button'

type Props = {
  open: boolean
  directoryCount: number
  totalBytes: number
  busy: boolean
  onConfirm: () => void
  onClose: () => void
}

export function ConfirmCleanupTemporaryFilesModal({
  open, directoryCount, totalBytes, busy, onConfirm, onClose,
}: Props) {
  const { t, locale } = useI18n()
  const dialogRef = useRef<HTMLDivElement>(null)
  const cancelRef = useRef<HTMLButtonElement>(null)

  useFocusTrap({
    containerRef: dialogRef,
    initialFocusRef: cancelRef,
    onClose,
    enabled: open,
    canEscape: !busy,
  })

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[70] grid place-items-center bg-black/80 p-4" onMouseDown={event => {
      if (!busy && event.target === event.currentTarget) onClose()
    }}>
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="cleanup-temp-title" aria-describedby="cleanup-temp-description" className="w-full max-w-[460px] border border-[#59634a] bg-wt-panel p-6 text-[#e3e4dc] shadow-2xl">
        <header className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center border border-[#4b5640] bg-[#293027] text-[#c1cd9c]"><Broom size={18} aria-hidden="true" /></span>
          <div className="min-w-0 flex-1">
            <h2 id="cleanup-temp-title" className="mb-1 font-display text-xl font-semibold">{t('temporaryFilesConfirmTitle')}</h2>
            <p id="cleanup-temp-description" className="mb-0 text-sm leading-6 text-[#b1b7ab]">{t('temporaryFilesConfirmBody', {
              count: directoryCount,
              size: formatFileSize(totalBytes, locale),
            })}</p>
          </div>
          <Button variant="icon" onClick={onClose} disabled={busy} aria-label={t('close')}><X size={17} /></Button>
        </header>
        <p className="mb-0 mt-4 border-l-2 border-[#8a7440] pl-3 text-xs leading-5 text-[#b5bdad]">{t('temporaryFilesSafetyNote')}</p>
        <footer className="mt-6 flex justify-end gap-2">
          <Button ref={cancelRef} variant="secondary" onClick={onClose} disabled={busy}>{t('skinCancel')}</Button>
          <Button variant="danger" onClick={onConfirm} disabled={busy}>{busy ? t('temporaryFilesCleaning') : t('temporaryFilesCleanAction')}</Button>
        </footer>
      </div>
    </div>
  )
}
