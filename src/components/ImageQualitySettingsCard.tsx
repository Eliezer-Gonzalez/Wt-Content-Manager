import { Image } from 'lucide-react'
import { useI18n } from '../i18n/I18nProvider'
import type { ImageQualityMode } from '../lib/imageQuality'
import { ImageQualitySelector } from './ImageQualitySelector'
import { ConfirmImageQualityChangeModal } from './ConfirmImageQualityChangeModal'
import { useState } from 'react'

type Props = {
  value: ImageQualityMode
  onChange: (quality: ImageQualityMode) => void
}

export function ImageQualitySettingsCard({ value, onChange }: Props) {
  const { t } = useI18n()
  const [pendingQuality, setPendingQuality] = useState<ImageQualityMode | null>(null)

  function confirmQualityChange() {
    if (!pendingQuality) return
    onChange(pendingQuality)
    setPendingQuality(null)
  }

  return (
    <>
      <section className="border border-[#343b32] bg-[#1d231d] xl:col-span-2" aria-labelledby="image-quality-settings-title">
        <div className="flex items-start gap-3 border-b border-[#343b32] px-5 py-4">
          <span className="grid size-10 shrink-0 place-items-center border border-[#4b5640] bg-[#293027] text-[#bcc899]">
            <Image size={18} aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="mb-1 text-[10px] tracking-[.13em] text-[#9eaa85]">{t('settingsDisplayEyebrow')}</p>
            <h2 id="image-quality-settings-title" className="mb-0 text-base font-medium text-[#e0e3d8]">
              {t('imageQualityTitle')}
            </h2>
          </div>
        </div>
        <div className="space-y-4 px-5 py-4">
          <p className="mb-0 text-xs leading-5 text-[#aab2a4]">{t('settingsImageQualityIntro')}</p>
          <ImageQualitySelector
            value={pendingQuality ?? value}
            onChange={nextQuality => {
              if (nextQuality !== value) setPendingQuality(nextQuality)
            }}
          />
          <p className="mb-0 text-xs leading-5 text-[#929a8e]">{t('imageQualityAvailabilityNote')}</p>
        </div>
      </section>
      <ConfirmImageQualityChangeModal
        quality={pendingQuality}
        onConfirm={confirmQualityChange}
        onClose={() => setPendingQuality(null)}
      />
    </>
  )
}
