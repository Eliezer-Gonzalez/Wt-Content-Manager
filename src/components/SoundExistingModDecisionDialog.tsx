import { useEffect, useRef } from 'react'
import { AlertTriangle, HardDriveDownload, LoaderCircle, Trash2, X } from 'lucide-react'
import { Button } from './ui/Button'
import { useFocusTrap } from '../hooks/useFocusTrap'
import { useI18n } from '../i18n/I18nContext'

type Props = {
  title: string
  description: string
  backupLabel: string
  deleteLabel: string
  warningText?: string
  busy: boolean
  busyLabel?: string
  busyDescription?: string
  onBackup: () => void
  onDelete: () => void
  onClose: () => void
}

export function SoundExistingModDecisionDialog({
  title, description, backupLabel, deleteLabel, warningText, busy, busyLabel, busyDescription,
  onBackup, onDelete, onClose,
}: Props) {
  const { t } = useI18n()
  const dialogRef = useRef<HTMLElement>(null)
  const cancelRef = useRef<HTMLButtonElement>(null)
  useFocusTrap({ containerRef: dialogRef, initialFocusRef: cancelRef, onClose, canEscape: !busy })

  useEffect(() => {
    if (busy) dialogRef.current?.focus()
  }, [busy])

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/80 p-4" onClick={() => !busy && onClose()}>
      <section
        ref={dialogRef}
        tabIndex={-1}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="sound-existing-title"
        aria-describedby="sound-existing-description sound-existing-warning"
        className="w-full max-w-[500px] border border-[#586b41] bg-wt-panel p-5"
        onClick={event => event.stopPropagation()}
      >
        <div className="flex items-start gap-3">
          <AlertTriangle size={19} className="mt-1 shrink-0 text-amber-300" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <h2 id="sound-existing-title" className="m-0 font-display text-2xl font-semibold text-[#e6e7dd]">{title}</h2>
            <p id="sound-existing-description" className="mb-0 mt-2 text-sm leading-6 text-[#c0c5bb]">{description}</p>
          </div>
          <Button variant="icon" onClick={onClose} disabled={busy} aria-label={t('close')}><X size={18} /></Button>
        </div>

        {busy ? (
          <div className="mt-4 border border-[#586b41] bg-[#202a1d] px-3 py-3" role="status" aria-live="polite">
            <div className="flex items-start gap-2.5">
              <LoaderCircle size={17} className="mt-0.5 shrink-0 animate-spin text-[#d3e2ad] motion-reduce:animate-none" aria-hidden="true" />
              <div>
                <p className="mb-1 text-sm font-semibold text-[#d3e2ad]">{busyLabel}</p>
                <p className="mb-0 text-xs leading-5 text-[#bdc5b4]">{busyDescription}</p>
              </div>
            </div>
            <div className="mt-3 h-1.5 overflow-hidden bg-[#30372f]" role="progressbar" aria-label={busyLabel}>
              <div className="sound-install-progress h-full w-2/5 bg-olive" />
            </div>
          </div>
        ) : (
          <div id="sound-existing-warning" className="mt-4 border border-[#766638] bg-[#302b1d] px-3 py-2.5 text-sm leading-5 text-[#dfd5b6]" role="note">
            {warningText ?? t('soundExistingModWarning')}
          </div>
        )}

        <div className="mt-5 flex flex-wrap justify-end gap-2">
          {busy ? (
            <span className="self-center text-xs text-[#aab2a4]">{t('soundInstallNotCancellable')}</span>
          ) : (
            <>
              <Button ref={cancelRef} onClick={onClose}>{t('skinCancel')}</Button>
              <Button variant="danger" onClick={onDelete}>
                <Trash2 size={14} aria-hidden="true" />{deleteLabel}
              </Button>
              <Button variant="primary" onClick={onBackup}>
                <HardDriveDownload size={14} aria-hidden="true" />{backupLabel}
              </Button>
            </>
          )}
        </div>
      </section>
    </div>
  )
}
