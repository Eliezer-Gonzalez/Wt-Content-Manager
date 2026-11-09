import { useRef } from 'react'
import { CheckCircle2, LoaderCircle, Trash2, X } from 'lucide-react'
import { Button } from './ui/Button'
import { useFocusTrap } from '../hooks/useFocusTrap'
import type { InstalledSkin } from '../lib/localLibrary'
import { useI18n } from '../i18n/I18nProvider'
import { truncateMiddle } from '../lib/format'

type Props = {
  entry: InstalledSkin | null
  busy: boolean
  error: string
  uninstalledFolder?: string | null
  onDismissNotice?: () => void
  onConfirm: () => void
  onClose: () => void
}

export function ConfirmUninstallModal({
  entry,
  busy,
  error,
  uninstalledFolder,
  onDismissNotice,
  onConfirm,
  onClose,
}: Props) {
  const { t } = useI18n()
  const containerRef = useRef<HTMLDivElement>(null)
  const cancelRef = useRef<HTMLButtonElement>(null)

  useFocusTrap({
    containerRef,
    initialFocusRef: cancelRef,
    onClose,
    enabled: Boolean(entry),
    canEscape: !busy,
    stopPropagationOnEscape: true,
  })

  if (!entry && !uninstalledFolder) return null

  return (
    <>
      {entry && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/75 p-4 backdrop-blur-[2px]"
          onMouseDown={event => {
            if (!busy && event.target === event.currentTarget) onClose()
          }}
        >
          <div
            ref={containerRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-uninstall-title"
            aria-describedby="confirm-uninstall-desc"
            className="w-full max-w-md border border-[#3c4538] bg-[#1e241e] p-6 shadow-2xl"
            onKeyDown={event => { if (event.key === 'Enter') event.preventDefault() }}
          >
            <div className="flex items-start gap-3">
              <span className="grid size-10 shrink-0 place-items-center border border-[#644b42] bg-[#2a201d] text-[#e0c1b5]">
                <Trash2 size={18} aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <h2 id="confirm-uninstall-title" className="font-display text-xl font-semibold leading-tight text-[#e6e7dd]">
                  {t('uninstallConfirmTitle')}
                </h2>
                <p id="confirm-uninstall-desc" className="mt-2 text-sm leading-relaxed text-[#b1b7ab]">
                  {t('uninstallConfirmBody', { folder: entry.folderName })}
                </p>
                {!entry.item && <p className="mb-0 mt-2 text-xs leading-5 text-[#c4cbae]">{t('externalSkinUninstallNote')}</p>}
              </div>
            </div>

            <p className="mt-4 break-all border border-[#343b32] bg-[#161a16] px-3 py-2 text-xs text-[#9fa899]" title={entry.path}>
              {truncateMiddle(entry.path, 72)}
            </p>

            {error && (
              <p className="mt-3 border border-amber-800/60 bg-amber-950/30 px-3 py-2 text-xs leading-relaxed text-amber-100" role="alert">
                {error}
              </p>
            )}

            <div className="mt-6 flex items-center justify-end gap-2.5">
              <Button ref={cancelRef} variant="secondary" onClick={onClose} disabled={busy}>
                {t('skinCancel')}
              </Button>
              <Button variant="danger" onClick={onConfirm} disabled={busy}>
                {busy && <LoaderCircle size={15} className="animate-spin motion-reduce:animate-none" aria-hidden="true" />}
                <span>{busy ? t('uninstallingSkin') : t('uninstallSkin')}</span>
              </Button>
            </div>
          </div>
        </div>
      )}

      {uninstalledFolder && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-4 right-4 z-[60] flex max-w-[calc(100vw-2rem)] items-center gap-3 border border-[#6a8051] bg-[#263321] px-4 py-3 text-sm font-medium text-[#e5f0d5] shadow-2xl sm:bottom-8 sm:right-8 sm:max-w-sm"
        >
          <CheckCircle2 size={16} className="shrink-0 text-[#aabd7c]" aria-hidden="true" />
          <span className="min-w-0 flex-1 leading-relaxed">
            {t('uninstallSuccessToast', { folder: uninstalledFolder })}
          </span>
          {onDismissNotice && (
            <button
              type="button"
              onClick={onDismissNotice}
              aria-label={t('close')}
              className="grid size-6 shrink-0 place-items-center text-[#959e8f] transition-colors hover:text-[#e2e5db] focus-visible:outline-2 focus-visible:outline-olive"
            >
              <X size={14} aria-hidden="true" />
            </button>
          )}
        </div>
      )}
    </>
  )
}
