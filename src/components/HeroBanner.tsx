import { LibraryInsignia } from './LibraryInsignia'
import { SettingsDials } from './SettingsDials'

export type BannerVariant = 'radar' | 'hazard' | 'favorites' | 'downloads' | 'settings'

type HeroBannerProps = {
  variant: BannerVariant
  /** Positioning and sizing classes for the absolute container. */
  className?: string
}

type RadarBlipSeed = {
  angle: number
  radius: number
}

const RADAR_PERIOD_SECONDS = 7

const RADAR_BLIP_SEEDS: RadarBlipSeed[] = [
  { angle: 50.5, radius: 16 },
  { angle: 106, radius: 33 },
  { angle: 275.9, radius: 31 },
]

const RADAR_BLIPS = RADAR_BLIP_SEEDS.map(({ angle, radius }) => {
  const rad = (angle * Math.PI) / 180
  const x = 50 + radius * Math.sin(rad)
  const y = 50 - radius * Math.cos(rad)
  const hit = (angle / 360) * RADAR_PERIOD_SECONDS
  return { x, y, hit }
})

export function HeroBanner({ variant, className = 'inset-0' }: HeroBannerProps) {
  // Synchronize radar phase across tab switches using wall-clock time
  const clockOffset = (Date.now() / 1000) % RADAR_PERIOD_SECONDS

  return (
    <div className={`pointer-events-none absolute overflow-hidden ${className}`} aria-hidden="true">
      {variant === 'radar' ? (
        <div className="radar">
          <div className="radar__grid" />
          <div className="radar__dial">
            <div
              className="radar__sweep"
              style={{ animationDelay: `-${clockOffset.toFixed(3)}s` }}
            />
            {RADAR_BLIPS.map((blip, index) => (
              <span
                key={index}
                className="radar__blip"
                style={{
                  left: `${blip.x.toFixed(2)}%`,
                  top: `${blip.y.toFixed(2)}%`,
                  animationDelay: `${(blip.hit - RADAR_PERIOD_SECONDS - clockOffset).toFixed(3)}s`,
                }}
              />
            ))}
          </div>
        </div>
      ) : (
        <div className="hazard">
          <div className="hazard__stripes" />
          <div className="hazard__edge" />
          {(variant === 'favorites' || variant === 'downloads') && <LibraryInsignia kind={variant} />}
          {variant === 'settings' && <SettingsDials />}
        </div>
      )}
    </div>
  )
}

export type SectionHeaderSize = 'home' | 'catalog' | 'compact'

type SectionHeaderProps = {
  variant: BannerVariant
  eyebrow: string
  title?: string
  titlePrefix?: string
  titleHighlight?: string
  subtitle?: string
  size?: SectionHeaderSize
}

export function SectionHeader({
  variant,
  eyebrow,
  title,
  titlePrefix,
  titleHighlight,
  subtitle,
}: SectionHeaderProps) {
  return (
    <section className="relative flex h-[204px] items-center justify-between overflow-hidden border-b border-[#31372f] px-[3px] pb-6 max-[720px]:h-[176px]">
      <HeroBanner variant={variant} className="inset-0" />
      <span
        className="pointer-events-none absolute inset-0 bg-gradient-to-r from-wt-bg/95 via-wt-bg/65 to-transparent"
        aria-hidden="true"
      />
      <div className="relative z-10 max-w-2xl">
        <p className="mb-0 flex max-w-full flex-wrap items-center gap-2 text-[12px] leading-5 tracking-[.08em] text-[#c0c9aa] sm:text-[13px]">
          <span className="h-px w-3.5 bg-[#acb98b]" />
          {eyebrow}
        </p>
        <h1 className="mb-2 mt-2.5 font-display text-[46px] font-semibold leading-[.97] tracking-[-.02em] text-[#e6e7dd] max-[720px]:text-[38px]">
          {title ?? (
            <>
              {titlePrefix && (
                <>
                  {titlePrefix}
                  <br />
                </>
              )}
              {titleHighlight && <em className="not-italic text-[#aeb990]">{titleHighlight}</em>}
            </>
          )}
        </h1>
        {subtitle && (
          <p className="mb-0 max-w-[42ch] text-sm leading-6 text-[#adb3a8]">{subtitle}</p>
        )}
      </div>
    </section>
  )
}
