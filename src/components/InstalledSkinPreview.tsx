import { useState } from 'react'
import { ImageOff } from 'lucide-react'
import { useI18n } from '../i18n/I18nContext'

type Props = {
  imageUrl?: string
  title: string
}

export function InstalledSkinPreview({ imageUrl, title }: Props) {
  const { t } = useI18n()
  const [failedUrl, setFailedUrl] = useState<string | null>(null)
  const hasImage = Boolean(imageUrl && failedUrl !== imageUrl)

  return (
    <div className="relative mb-4 aspect-[16/9] overflow-hidden border border-[#343b32] bg-[#171d18]" aria-label={t('installedSkinPreview')}>
      {hasImage ? (
        <>
          <img src={imageUrl} alt="" aria-hidden="true" className="absolute inset-0 size-full scale-110 object-cover opacity-35 blur-xl" loading="lazy" />
          <img
            src={imageUrl}
            alt={t('installedSkinPreviewAlt', { title })}
            className="absolute inset-0 size-full object-contain"
            loading="lazy"
            onError={() => setFailedUrl(imageUrl ?? null)}
          />
        </>
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-[#879080]">
          <ImageOff size={24} strokeWidth={1.5} aria-hidden="true" />
          <span className="text-xs">{t('installedSkinPreviewUnavailable')}</span>
        </div>
      )}
    </div>
  )
}
