import { useMemo } from 'react'
import { useI18n } from '../i18n/I18nProvider'
import { getFullResolutionImageUrl, type WtLiveDetail, type WtLiveImage, type WtLiveItem } from '../lib/wtLive'
import { imageSourceForQuality, type ImageQualityMode } from '../lib/imageQuality'
import { HashtagList } from './HashtagList'
import { PostDetailSkeleton } from './PostDetailSkeleton'
import { PostGallery } from './PostGallery'
import { PostImage } from './PostImage'
import { WtLiveDescriptionText } from './WtLiveDescriptionText'

type ZoomedImage = { src: string; alt: string }

type Props = {
  item: WtLiveItem
  detail: WtLiveDetail | null
  imageQuality: ImageQualityMode
  loading: boolean
  error: string
  installing: boolean
  onZoom: (image: ZoomedImage) => void
  onOverlayChange: (open: boolean) => void
  onSearchHashtag: (hashtag: string) => void
}

export function PostDetailBody({
  item, detail, imageQuality, loading, error, installing, onZoom, onOverlayChange, onSearchHashtag,
}: Props) {
  const { t } = useI18n()
  const hasDescription = detail?.description.some(block => block.type !== 'image') ?? false
  const previewImage = useMemo(() => item.imageUrl
    ? {
        src: item.imageUrl,
        fullResolutionSrc: getFullResolutionImageUrl(item.imageUrl),
        aspectRatio: item.imageAspectRatio,
      }
    : null, [item.imageUrl, item.imageAspectRatio])
  const galleryImages = useMemo(() => {
    const detailedImages = detail?.images ?? []
    const images: WtLiveImage[] = detailedImages.length
      ? previewImage
        ? [
            {
              ...detailedImages[0],
              src: previewImage.src,
              fullResolutionSrc: detailedImages[0].fullResolutionSrc || previewImage.fullResolutionSrc,
              aspectRatio: previewImage.aspectRatio || detailedImages[0].aspectRatio,
              width: detailedImages[0].width,
              height: detailedImages[0].height,
            },
            ...detailedImages.slice(1),
          ]
        : detailedImages
      : previewImage
        ? [previewImage]
        : []
    const seen = new Set<string>()
    return images.filter(image => {
      const key = image.fullResolutionSrc || image.src
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
  }, [detail?.images, previewImage])
  const fallbackDescription = item.description.replace(/#[\p{L}\p{N}_-]+/gu, ' ').replace(/\s+/g, ' ').trim()

  if (loading) return <PostDetailSkeleton label={t('detailLoading')} />
  if (error) return <p className="my-6 text-sm leading-relaxed text-amber-200" role="alert">{error}</p>

  return (
    <>
      <section className="space-y-4 text-sm leading-7 text-[#c0c5bb]" aria-labelledby="post-description-heading">
        {hasDescription && (
          <h3 id="post-description-heading" className="mb-0 border-l-2 border-[#87976a] pl-3 text-xs font-semibold uppercase tracking-[.12em] text-[#c8d1b6]">
            {t('description')}
          </h3>
        )}
        <PostGallery
          images={galleryImages}
          quality={imageQuality}
          title={item.title || t('postFallbackTitle', { id: item.id })}
          onZoom={image => onZoom({ src: image.src, alt: image.alt })}
        />
        {detail?.description.length ? (
          detail.description.map((block, index) => block.type === 'image' ? (
            <button
              type="button"
              className="my-3 block w-full cursor-zoom-in"
              key={`${block.src}-${index}`}
              onClick={() => onZoom({
                src: block.fullResolutionSrc || getFullResolutionImageUrl(block.src),
                alt: block.alt || t('postImageAlt'),
              })}
              aria-label={`${t('enlargeImage')}: ${block.alt || t('postImageAlt')}`}
            >
              <PostImage
                className="h-auto max-h-[65vh] w-full object-contain"
                image={{ ...block, src: imageSourceForQuality(block.src, block.fullResolutionSrc, imageQuality) }}
                alt={block.alt || t('postImageAlt')}
                loading="lazy"
              />
            </button>
          ) : (
            <WtLiveDescriptionText block={block} imageQuality={imageQuality} onOverlayChange={onOverlayChange} originPost={item} key={index} />
          ))
        ) : (
          <WtLiveDescriptionText
            block={{ type: 'text', text: fallbackDescription || t('noDescription') }}
            imageQuality={imageQuality}
            onOverlayChange={onOverlayChange}
            originPost={item}
          />
        )}
      </section>
      <HashtagList hashtags={detail?.hashtags ?? []} disabled={installing} id="post-hashtags-heading" onSelect={onSearchHashtag} />
    </>
  )
}
