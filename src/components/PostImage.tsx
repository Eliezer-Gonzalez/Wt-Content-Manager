import { useState } from 'react'
import type { WtLiveImage } from '../lib/wtLive'

type Props = {
  image: WtLiveImage
  alt: string
  className: string
  loading?: 'eager' | 'lazy'
  fetchPriority?: 'high' | 'low' | 'auto'
}

function getReservedDimensions(image: WtLiveImage) {
  const hasDimensions = Boolean(image.width && image.height)
  const ratio = hasDimensions || !image.aspectRatio
    ? undefined
    : Math.max(0.45, Math.min(2.5, image.aspectRatio))
  const width = image.width ?? (ratio
    ? image.height
      ? Math.max(1, Math.round(image.height * ratio))
      : 1200
    : undefined)
  const height = image.height ?? (width && ratio ? Math.max(1, Math.round(width / ratio)) : undefined)
  return { width, height }
}

export function PostImage({
  image,
  alt,
  className,
  loading = 'lazy',
  fetchPriority = 'auto',
}: Props) {
  const [loadedSrc, setLoadedSrc] = useState<string | null>(null)
  const isLoaded = loadedSrc === image.src
  const dimensions = getReservedDimensions(image)

  return (
    <div className="relative w-full overflow-hidden bg-[#1a201b]">
      {!isLoaded && (
        <div
          className="absolute inset-0 animate-pulse bg-[#293128]"
          aria-hidden="true"
        />
      )}
      <img
        src={image.src}
        alt={alt}
        width={dimensions.width}
        height={dimensions.height}
        className={`relative z-[1] bg-[#1a201b] transition-opacity duration-200 ${isLoaded ? 'opacity-100' : 'opacity-0'} ${className}`}
        loading={loading}
        fetchPriority={fetchPriority}
        decoding="async"
        onLoad={() => setLoadedSrc(image.src)}
        onError={() => setLoadedSrc(image.src)}
      />
    </div>
  )
}
