import { useRef, useState } from 'react'
import { Image } from 'lucide-react'
import { useFocusTrap } from '../hooks/useFocusTrap'
import type { ImageQualityMode } from '../lib/imageQuality'
import { useI18n } from '../i18n/I18nProvider'
import { Button } from './ui/Button'
import { ImageQualitySelector } from './ImageQualitySelector'

type Props = {
  open: boolean
  keepWindowControlsVisible: boolean
  initialQuality: ImageQualityMode
  onConfirm: (quality: ImageQualityMode) => void
}

export function ImageQualitySetupDialog({ open, keepWindowControlsVisible, initialQuality, onConfirm }: Props) {
  const { t } = useI18n()
  const [selectedQuality, setSelectedQuality] = useState(initialQuality)
  const dialogRef = useRef<HTMLDivElement>(null)
  const confirmRef = useRef<HTMLButtonElement>(null)

  useFocusTrap({
    containerRef: dialogRef,
    initialFocusRef: confirmRef,
    enabled: open,
    onClose: () => {},
    canEscape: false,
    stopPropagationOnEscape: true,
  })

  if (!open) return null

  return (
    <div className={`fixed inset-x-0 bottom-0 z-[110] grid place-items-center overflow-y-auto bg-black/85 p-4 ${keepWindowControlsVisible ? 'top-9' : 'top-0'}`}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="image-quality-setup-title"
        className={`my-auto w-full max-w-[600px] border border-[#46503f] bg-wt-panel text-[#e3e4dc] shadow-2xl ${keepWindowControlsVisible ? 'max-h-[calc(100dvh-4.25rem)] overflow-y-auto' : 'max-h-[calc(100dvh-2rem)] overflow-y-auto'}`}
      >
        <header className="border-b border-[#343b32] px-6 py-6 max-[420px]:px-5">
          <span className="mb-4 grid size-10 place-items-center border border-[#4b5640] bg-[#293027] text-[#c9d4a9]">
            <Image size={19} aria-hidden="true" />
          </span>
          <h1 id="image-quality-setup-title" className="mb-2 font-display text-3xl font-semibold leading-tight text-[#e6e7dd]">
            {t('imageQualitySetupTitle')}
          </h1>
          <p className="mb-0 text-sm leading-6 text-[#c4cabe]">{t('imageQualitySetupIntro')}</p>
        </header>
        <div className="space-y-4 px-6 py-5 max-[420px]:px-5">
          <ImageQualitySelector value={selectedQuality} onChange={setSelectedQuality} />
          <p className="mb-0 border-l-2 border-[#8a7440] pl-3.5 text-xs leading-5 text-[#d0c294]">
            {t('imageQualityAvailabilityNote')}
          </p>
          <p className="mb-0 text-xs leading-5 text-[#929a8e]">{t('imageQualityCanChangeLater')}</p>
        </div>
        <footer className="border-t border-[#343b32] px-6 py-4 max-[420px]:px-5">
          <Button ref={confirmRef} variant="primary" className="w-full justify-center" onClick={() => onConfirm(selectedQuality)}>
            {t('imageQualityConfirm')}
          </Button>
        </footer>
      </div>
    </div>
  )
}
