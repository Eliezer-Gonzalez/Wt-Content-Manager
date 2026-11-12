import { useRef } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'
import { Button } from './ui/Button'
import { AppTooltip } from './ui/AppTooltip'
import { useFocusTrap } from '../hooks/useFocusTrap'
import { useI18n } from '../i18n/I18nContext'
import type { InstalledSkin } from '../lib/localLibrary'

type Props = {
  entry: InstalledSkin | null
  onConfirm: () => void
  onClose: () => void
}

export function ConfirmReinstallModal({ entry, onConfirm, onClose }: Props) {
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
    <div className="fixed inset-0 z-[70] grid place-items-center bg-black/75 p-4 backdrop-blur-[2px]" onMouseDown={event => {
      if (event.target === event.currentTarget) onClose()
    }}>
      <div ref={containerRef} role="dialog" aria-modal="true" aria-labelledby="confirm-reinstall-title" aria-describedby="confirm-reinstall-desc" className="w-full max-w-md border border-[#514a32] bg-[#1e241e] p-5 shadow-2xl">
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center border border-[#685936] bg-[#2b281d] text-[#e3c36e]"><AlertTriangle size={18} aria-hidden="true" /></span>
          <div className="min-w-0 flex-1">
            <h2 id="confirm-reinstall-title" className="font-display text-lg font-semibold leading-tight text-[#e6e7dd]">{t('reinstallConfirmTitle')}</h2>
            <p id="confirm-reinstall-desc" className="mt-2 text-sm leading-relaxed text-[#b1b7ab]">{t('reinstallConfirmBody', { folder: entry.folderName })}</p>
          </div>
        </div>
        <AppTooltip content={entry.path} className="mt-4 w-full"><div className="w-full"><p className="mb-0 w-full truncate border border-[#343b32] bg-[#161a16] px-3 py-2 text-xs text-[#9fa899]">{entry.path}</p></div></AppTooltip>
        <div className="mt-5 flex items-center justify-end gap-2.5">
          <Button ref={cancelRef} variant="secondary" onClick={onClose}>{t('skinCancel')}</Button>
          <Button variant="primary" onClick={onConfirm}><RefreshCw size={15} aria-hidden="true" />{t('reinstallSkin')}</Button>
        </div>
      </div>
    </div>
  )
}
