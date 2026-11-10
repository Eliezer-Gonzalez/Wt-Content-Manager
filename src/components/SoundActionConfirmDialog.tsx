import { useRef } from 'react'
import { AlertTriangle, X } from 'lucide-react'
import { Button } from './ui/Button'
import { useI18n } from '../i18n/I18nProvider'
import { useFocusTrap } from '../hooks/useFocusTrap'

type Props = {
  title: string
  description: string
  actionLabel: string
  busy?: boolean
  onConfirm: () => void
  onClose: () => void
}

export function SoundActionConfirmDialog({ title, description, actionLabel, busy = false, onConfirm, onClose }: Props) {
  const { t } = useI18n()
  const dialogRef = useRef<HTMLElement>(null)
  const cancelRef = useRef<HTMLButtonElement>(null)
  useFocusTrap({ containerRef: dialogRef, initialFocusRef: cancelRef, onClose, canEscape: !busy })
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/80 p-4" onClick={() => !busy && onClose()}>
      <section ref={dialogRef} role="alertdialog" aria-modal="true" aria-labelledby="sound-confirm-title" className="w-full max-w-[450px] border border-[#46503f] bg-wt-panel p-5" onClick={event => event.stopPropagation()}>
        <div className="flex items-start gap-3">
          <AlertTriangle size={19} className="mt-1 shrink-0 text-amber-300" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <h2 id="sound-confirm-title" className="m-0 font-display text-2xl font-semibold text-[#e6e7dd]">{title}</h2>
            <p className="mb-0 mt-2 text-sm leading-6 text-[#c0c5bb]">{description}</p>
          </div>
          <Button variant="icon" onClick={onClose} disabled={busy} aria-label={t('close')}><X size={18} /></Button>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <Button ref={cancelRef} onClick={onClose} disabled={busy}>{t('skinCancel')}</Button>
          <Button variant="primary" onClick={onConfirm} disabled={busy}>{actionLabel}</Button>
        </div>
      </section>
    </div>
  )
}
