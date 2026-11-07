import { useState } from 'react'
import { useI18n } from '../i18n/I18nProvider'

type Props = {
  images: string[]
  title: string
  onZoom: (image: { src: string; alt: string }) => void
}

export function PostGallery({ images, title, onZoom }: Props) {
  const { t } = useI18n()
  const [activeIndex, setActiveIndex] = useState(0)
  const [prevImages, setPrevImages] = useState(images)

  if (prevImages !== images) {
    setPrevImages(images)
    setActiveIndex(0)
  }

  if (!images.length) return null

  const activeImage = images[activeIndex] ?? images[0]

  return (
    <div className="my-3 space-y-2">
      <button
        type="button"
        className="block w-full cursor-zoom-in"
        onClick={() => onZoom({ src: activeImage, alt: `${title} - ${activeIndex + 1}` })}
        aria-label={`${t('enlargeImage')}: ${title} - ${activeIndex + 1}`}
      >
        <img
          className="h-auto max-h-[65vh] w-full object-contain"
          src={activeImage}
          alt={`${title} - ${activeIndex + 1}`}
          loading="lazy"
        />
      </button>

      {images.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-2 pt-1 scrollbar-thin">
          {images.map((src, index) => {
            const isSelected = index === activeIndex
            return (
              <button
                key={`${src}-${index}`}
                type="button"
                onClick={() => setActiveIndex(index)}
                className={`size-16 sm:size-18 shrink-0 overflow-hidden border transition-all ${
                  isSelected
                    ? 'border-[#a8b884] ring-2 ring-[#a8b884]/40'
                    : 'border-[#394234] opacity-70 hover:opacity-100 hover:border-[#6f7e5d]'
                }`}
                aria-label={t('galleryThumbnailAria', { current: index + 1, total: images.length })}
                aria-current={isSelected}
              >
                <img
                  src={src}
                  alt=""
                  className="size-full object-cover"
                  loading="lazy"
                />
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
