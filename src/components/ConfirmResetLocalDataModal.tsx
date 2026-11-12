import { useRef } from 'react'
import { AlertTriangle, X } from 'lucide-react'
import { useFocusTrap } from '../hooks/useFocusTrap'
import { useI18n } from '../i18n/I18nContext'
import { Button } from './ui/Button'

type Props = {
  open: boolean
  error: boolean
  onConfirm: () => void
  onClose: () => void
}

export function ConfirmResetLocalDataModal({ open, error, onConfirm, onClose }: Props) {
  const { t } = useI18n()
  const dialogRef = useRef<HTMLDivElement>(null)
  const cancelRef = useRef<HTMLButtonElement>(null)

  useFocusTrap({ containerRef: dialogRef, initialFocusRef: cancelRef, onClose, enabled: open })

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[70] grid place-items-center bg-black/80 p-4" onMouseDown={event => {
      if (event.target === event.currentTarget) onClose()
    }}>
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="reset-local-data-title" aria-describedby="reset-local-data-description" className="w-full max-w-[480px] border border-[#644b42] bg-wt-panel p-6 text-[#e3e4dc] shadow-2xl">
        <header className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center border border-[#644b42] bg-[#2a201d] text-[#e0c1b5]"><AlertTriangle size={18} aria-hidden="true" /></span>
          <div className="min-w-0 flex-1">
            <h2 id="reset-local-data-title" className="mb-1 font-display text-xl font-semibold">{t('resetLocalDataConfirmTitle')}</h2>
            <p id="reset-local-data-description" className="mb-0 text-sm leading-6 text-[#b1b7ab]">{t('resetLocalDataConfirmBody')}</p>
          </div>
          <Button variant="icon" onClick={onClose} aria-label={t('close')}><X size={17} /></Button>
        </header>
        {error && <p className="mb-0 mt-4 border border-amber-800/60 bg-amber-950/30 px-3 py-2 text-xs text-amber-100" role="alert">{t('resetLocalDataFailed')}</p>}
        <footer className="mt-6 flex justify-end gap-2">
          <Button ref={cancelRef} variant="secondary" onClick={onClose}>{t('skinCancel')}</Button>
          <Button variant="danger" onClick={onConfirm}>{t('resetLocalDataAction')}</Button>
        </footer>
      </div>
    </div>
  )
}
