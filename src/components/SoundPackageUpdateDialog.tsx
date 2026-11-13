import { useRef } from 'react'
import { AlertTriangle, X } from 'lucide-react'
import { Button } from './ui/Button'
import { useFocusTrap } from '../hooks/useFocusTrap'
import { useI18n } from '../i18n/I18nContext'
import type { SoundPackage } from '../lib/sounds'

type Props = {
  packageInfo: SoundPackage
  remoteArchiveName?: string
  busy?: boolean
  onConfirm: () => void
  onClose: () => void
}

export function SoundPackageUpdateDialog({ packageInfo, remoteArchiveName, busy = false, onConfirm, onClose }: Props) {
  const { t } = useI18n()
  const dialogRef = useRef<HTMLElement>(null)
  const cancelRef = useRef<HTMLButtonElement>(null)
  useFocusTrap({ containerRef: dialogRef, initialFocusRef: cancelRef, onClose, canEscape: !busy })

  return (
    <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/80 p-3 sm:p-4" onClick={() => !busy && onClose()}>
      <section
        ref={dialogRef}
        tabIndex={-1}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="sound-update-title"
        aria-describedby="sound-update-description"
        className="my-auto max-h-[calc(100dvh-1.5rem)] w-full max-w-[450px] overflow-y-auto border border-[#46503f] bg-wt-panel p-4 sm:max-h-[calc(100dvh-2rem)] sm:p-5"
        onClick={event => event.stopPropagation()}
      >
        <div className="flex items-start gap-3">
          <AlertTriangle size={19} className="mt-1 shrink-0 text-amber-300" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <h2 id="sound-update-title" className="m-0 font-display text-xl font-semibold text-[#e6e7dd] sm:text-2xl">{t('soundUpdateConfirmTitle')}</h2>
            <p id="sound-update-description" className="mb-0 mt-2 break-words text-sm leading-6 text-[#c0c5bb]">
              {t('soundUpdateConfirmDescription', { title: packageInfo.title || packageInfo.archiveName })}
            </p>
          </div>
          <Button variant="icon" onClick={onClose} aria-label={t('close')}><X size={18} /></Button>
        </div>
        <div className="mt-4 border border-[#586b41] bg-[#202a1d] px-3 py-3 text-sm text-[#c4d79d]">
          <p className="mb-1 text-xs uppercase tracking-wide text-[#a8b39a]">{t('soundUpdateLatestArchive')}</p>
          <p className="mb-0 break-all">{remoteArchiveName || packageInfo.archiveName}</p>
        </div>
        <p className="mb-0 mt-3 text-xs leading-5 text-[#aab2a4]">{t('soundUpdateInstallSeparately')}</p>
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button ref={cancelRef} onClick={onClose} disabled={busy}>{t('skinCancel')}</Button>
          <Button variant="primary" onClick={onConfirm} disabled={busy}>{t('soundUpdateConfirmAction')}</Button>
        </div>
      </section>
    </div>
  )
}
