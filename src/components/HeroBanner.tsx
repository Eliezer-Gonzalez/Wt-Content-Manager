import { WT_LIVE_HEADER_IMAGE } from '../lib/wtLiveAssets'

type Props = {
  /** Positioning and sizing classes for the absolute container. */
  className: string
  /** Horizontal gradient classes (from/via/to) that fade the image into the page background. */
  horizontalFade: string
}

export function HeroBanner({ className, horizontalFade }: Props) {
  return (
    <div className={`pointer-events-none absolute overflow-hidden ${className}`} aria-hidden="true">
      <img
        src={WT_LIVE_HEADER_IMAGE}
        alt=""
        className="size-full origin-left scale-[1.2] object-cover object-[82%_48%] opacity-85"
      />
      <span className={`absolute inset-0 bg-gradient-to-r ${horizontalFade}`} />
      <span className="absolute inset-0 bg-gradient-to-b from-wt-bg/5 via-transparent to-wt-bg/15" />
    </div>
  )
}
