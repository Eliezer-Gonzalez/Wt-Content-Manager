import { useRef } from 'react'
import { Image, X } from 'lucide-react'
import { useFocusTrap } from '../hooks/useFocusTrap'
import { useI18n } from '../i18n/I18nProvider'
import type { ImageQualityMode } from '../lib/imageQuality'
import { Button } from './ui/Button'

type Props = {
  quality: ImageQualityMode | null
  onConfirm: () => void
  onClose: () => void
}

export function ConfirmImageQualityChangeModal({ quality, onConfirm, onClose }: Props) {
  const { t } = useI18n()
  const containerRef = useRef<HTMLDivElement>(null)
  const cancelRef = useRef<HTMLButtonElement>(null)
  const qualityLabel = quality === 'optimized' ? t('imageQualityOptimized') : t('imageQualityHigh')

  useFocusTrap({
    containerRef,
    initialFocusRef: cancelRef,
    onClose,
    enabled: Boolean(quality),
    stopPropagationOnEscape: true,
  })

  if (!quality) return null

  return (
    <div
      className="fixed inset-0 z-[110] grid place-items-center bg-black/80 p-4 backdrop-blur-[2px]"
      onMouseDown={event => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="image-quality-change-title"
        aria-describedby="image-quality-change-body"
        className="w-full max-w-md border border-[#46503f] bg-wt-panel p-6 text-[#e3e4dc] shadow-2xl"
      >
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center border border-[#4b5640] bg-[#293027] text-[#c9d4a9]">
            <Image size={18} aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 id="image-quality-change-title" className="font-display text-xl font-semibold leading-tight text-[#e6e7dd]">
              {t('imageQualityChangeTitle', { mode: qualityLabel })}
            </h2>
            <p id="image-quality-change-body" className="mt-2 text-sm leading-relaxed text-[#b1b7ab]">
              {t('imageQualityChangeBody')}
            </p>
          </div>
          <Button variant="icon" size="sm" onClick={onClose} aria-label={t('close')}>
            <X size={16} aria-hidden="true" />
          </Button>
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-end gap-2.5">
          <Button ref={cancelRef} variant="secondary" onClick={onClose}>
            {t('skinCancel')}
          </Button>
          <Button variant="primary" onClick={onConfirm}>
            {t('imageQualityChangeConfirm')}
          </Button>
        </div>
      </div>
    </div>
  )
}
