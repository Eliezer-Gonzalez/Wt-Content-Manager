import { AlertTriangle } from 'lucide-react'
import { Button } from './ui/Button'
import { useFocusTrap } from '../hooks/useFocusTrap'
import { useI18n } from '../i18n/I18nProvider'
import { useRef } from 'react'

type Props = {
  onContinue: () => void
  onConfirmCancel: () => void
  onDismiss: () => void
}

export function DownloadCancelConfirmDialog({ onContinue, onConfirmCancel, onDismiss }: Props) {
  const { t } = useI18n()
  const dialogRef = useRef<HTMLElement>(null)
  const continueRef = useRef<HTMLButtonElement>(null)

  useFocusTrap({ containerRef: dialogRef, initialFocusRef: continueRef, onClose: onDismiss })

  return (
    <div className="fixed inset-0 z-[70] grid place-items-center bg-black/80 p-4" onClick={onDismiss}>
      <section
        ref={dialogRef}
        tabIndex={-1}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="download-cancel-title"
        aria-describedby="download-cancel-description"
        className="w-full max-w-[460px] border border-[#586b41] bg-wt-panel p-5"
        onClick={event => event.stopPropagation()}
      >
        <div className="flex items-start gap-3">
          <AlertTriangle size={19} className="mt-1 shrink-0 text-amber-300" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <h2 id="download-cancel-title" className="m-0 font-display text-2xl font-semibold text-[#e6e7dd]">
              {t('confirmCancelDownloadTitle')}
            </h2>
            <p id="download-cancel-description" className="mb-0 mt-2 text-sm leading-6 text-[#c0c5bb]">
              {t('confirmCancelDownloadDescription')}
            </p>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <Button ref={continueRef} variant="secondary" onClick={onContinue}>{t('continueDownload')}</Button>
          <Button variant="danger" onClick={onConfirmCancel}>{t('confirmCancelDownload')}</Button>
        </div>
      </section>
    </div>
  )
}
