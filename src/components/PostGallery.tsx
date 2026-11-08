import { useState } from 'react'
import { useI18n } from '../i18n/I18nProvider'
import { PostImage } from './PostImage'
import type { WtLiveImage } from '../lib/wtLive'
import type { ImageQualityMode } from '../lib/imageQuality'
import { imageSourceForQuality } from '../lib/imageQuality'

type Props = {
  images: WtLiveImage[]
  quality: ImageQualityMode
  title: string
  onZoom: (image: { src: string; alt: string }) => void
}

export function PostGallery({ images, quality, title, onZoom }: Props) {
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
        onClick={() => onZoom({ src: activeImage.fullResolutionSrc || activeImage.src, alt: `${title} - ${activeIndex + 1}` })}
        aria-label={`${t('enlargeImage')}: ${title} - ${activeIndex + 1}`}
      >
        <PostImage
          className="h-auto max-h-[65vh] w-full object-contain"
          image={{
            ...activeImage,
            src: imageSourceForQuality(activeImage.src, activeImage.fullResolutionSrc, quality),
          }}
          alt={`${title} - ${activeIndex + 1}`}
          loading="eager"
          fetchPriority="high"
        />
      </button>

      {images.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-2 pt-1 scrollbar-thin">
          {images.map((image, index) => {
            const isSelected = index === activeIndex
            return (
              <button
                key={`${image.src}-${index}`}
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
                  src={image.thumbnailSrc || image.src}
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
