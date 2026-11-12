import { useEffect, useRef } from 'react'
import { AlertTriangle, CircleAlert, LoaderCircle, X } from 'lucide-react'
import { Button } from './ui/Button'
import { useI18n } from '../i18n/I18nContext'
import { useFocusTrap } from '../hooks/useFocusTrap'

type Props = {
  title: string
  description: string
  actionLabel: string
  busy?: boolean
  busyLabel?: string
  busyDescription?: string
  onConfirm: () => void
  onClose: () => void
}

export function SoundActionConfirmDialog({ title, description, actionLabel, busy = false, busyLabel, busyDescription, onConfirm, onClose }: Props) {
  const { t } = useI18n()
  const dialogRef = useRef<HTMLElement>(null)
  const cancelRef = useRef<HTMLButtonElement>(null)
  useFocusTrap({ containerRef: dialogRef, initialFocusRef: cancelRef, onClose, canEscape: !busy })
  useEffect(() => {
    if (busy && busyLabel) dialogRef.current?.focus()
  }, [busy, busyLabel])
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/80 p-4" onClick={() => !busy && onClose()}>
      <section ref={dialogRef} tabIndex={-1} role="alertdialog" aria-modal="true" aria-labelledby="sound-confirm-title" aria-describedby={busy && busyLabel ? 'sound-confirm-description sound-confirm-progress-description' : 'sound-confirm-description sound-confirm-warning'} className="w-full max-w-[450px] border border-[#46503f] bg-wt-panel p-5" onClick={event => event.stopPropagation()}>
        <div className="flex items-start gap-3">
          <AlertTriangle size={19} className="mt-1 shrink-0 text-amber-300" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <h2 id="sound-confirm-title" className="m-0 font-display text-2xl font-semibold text-[#e6e7dd]">{title}</h2>
            <p id="sound-confirm-description" className="mb-0 mt-2 text-sm leading-6 text-[#c0c5bb]">{description}</p>
          </div>
          <Button variant="icon" onClick={onClose} disabled={busy} aria-label={t('close')}><X size={18} /></Button>
        </div>
        {busy && busyLabel ? (
          <div className="mt-4 border border-[#586b41] bg-[#202a1d] px-3 py-3" role="status" aria-live="polite">
            <div className="flex items-start gap-2.5">
              <LoaderCircle size={17} className="mt-0.5 shrink-0 animate-spin text-[#d3e2ad] motion-reduce:animate-none" aria-hidden="true" />
              <div>
                <p className="mb-1 text-sm font-semibold text-[#d3e2ad]">{busyLabel}</p>
                <p id="sound-confirm-progress-description" className="mb-0 text-xs leading-5 text-[#bdc5b4]">{busyDescription}</p>
              </div>
            </div>
            <div className="mt-3 h-1.5 overflow-hidden bg-[#30372f]" role="progressbar" aria-label={busyLabel}>
              <div className="sound-install-progress h-full w-2/5 bg-olive" />
            </div>
          </div>
        ) : (
          <div id="sound-confirm-warning" className="mt-4 flex items-start gap-2.5 border border-[#766638] bg-[#302b1d] px-3 py-2.5" role="note">
            <CircleAlert size={16} className="mt-0.5 shrink-0 text-amber-300" aria-hidden="true" />
            <p className="mb-0 text-sm leading-5 text-[#dfd5b6]">
              <strong className="font-semibold text-[#f1e6c5]">{t('soundGameName')}</strong>{' '}
              {t('soundGameMustBeConnector')}{' '}
              <strong className="border-b border-amber-300/70 font-bold text-amber-200">{t('soundGameMustBeClosedState')}</strong>
            </p>
          </div>
        )}
        <div className="mt-6 flex justify-end gap-2">
          {busy && busyLabel ? (
            <span className="text-xs text-[#aab2a4]">{t('soundInstallNotCancellable')}</span>
          ) : (
            <>
              <Button ref={cancelRef} onClick={onClose} disabled={busy}>{t('skinCancel')}</Button>
              <Button variant="primary" onClick={onConfirm} disabled={busy}>{actionLabel}</Button>
            </>
          )}
        </div>
      </section>
    </div>
  )
}
