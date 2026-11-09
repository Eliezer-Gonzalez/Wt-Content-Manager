import { useId } from 'react'

type Props = { kind: 'favorites' | 'downloads' }

const STAR_POINTS = '50,6 61.17,36.63 93.75,37.79 68.07,57.87 77.04,89.21 50,71 22.96,89.21 31.93,57.87 6.25,37.79 38.83,36.63'

export function LibraryInsignia({ kind }: Props) {
  const id = useId().replace(/:/g, '')
  const clipId = `${kind}-clip-${id}`
  const shineId = `${kind}-shine-${id}`

  return (
    <div className="insignia" aria-hidden="true">
      <div className="insignia__glow" />
      <div className="insignia__backing" />
      <svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg">
        <defs>
          {kind === 'favorites' ? (
            <clipPath id={clipId}>
              <polygon transform="translate(10 10)" points={STAR_POINTS} />
            </clipPath>
          ) : (
            <clipPath id={clipId}>
              <path d="M26 50 Q60 6 94 50 Q84 44 77 50 Q68 44 60 50 Q52 44 43 50 Q36 44 26 50 Z" />
              <rect x="48" y="82" width="24" height="18" />
            </clipPath>
          )}
          <linearGradient id={shineId} x1="0" x2="1" y1="0" y2="0">
            <stop offset="0" stopColor="#fff" stopOpacity="0" />
            <stop offset=".5" stopColor="#fff" stopOpacity=".9" />
            <stop offset="1" stopColor="#fff" stopOpacity="0" />
          </linearGradient>
        </defs>
        <circle cx="60" cy="60" r="57" fill="none" stroke="var(--color-insignia-gold, #E8CB5A)" strokeWidth="2.5" />
        <g className="insignia__ticks">
          <circle cx="60" cy="60" r="51" fill="none" stroke="var(--color-insignia-gold, #E8CB5A)" strokeWidth="2" strokeDasharray="1.5 5" opacity=".7" />
        </g>
        {kind === 'favorites' ? <FavoriteStar /> : <SupplyDrop clipId={clipId} shineId={shineId} />}
        {kind === 'favorites' && (
          <g clipPath={`url(#${clipId})`}>
            <g className="insignia__shine"><ShineRect shineId={shineId} /></g>
          </g>
        )}
      </svg>
    </div>
  )
}

function FavoriteStar() {
  return (
    <>
      <polygon transform="translate(10 10)" fill="var(--color-insignia-gold, #E8CB5A)" points={STAR_POINTS} />
      <polygon transform="translate(10 10) translate(20 20.8) scale(.6)" fill="none" stroke="var(--color-wt-bg, #171916)" strokeWidth="3" points={STAR_POINTS} />
    </>
  )
}

function SupplyDrop({ clipId, shineId }: { clipId: string; shineId: string }) {
  return (
    <g className="insignia__sway">
      <g fill="none" stroke="var(--color-insignia-gold, #E8CB5A)" strokeWidth="1.2" opacity=".9">
        <path d="M26 50 L50 82" /><path d="M43 50 L53 82" /><path d="M60 50 L60 82" /><path d="M77 50 L67 82" /><path d="M94 50 L70 82" />
      </g>
      <path fill="var(--color-insignia-gold, #E8CB5A)" d="M26 50 Q60 6 94 50 Q84 44 77 50 Q68 44 60 50 Q52 44 43 50 Q36 44 26 50 Z" />
      <g fill="none" stroke="var(--color-wt-bg, #171916)" strokeWidth="2">
        <path d="M60 28 L60 50" /><path d="M44 34 Q40 42 43 50" /><path d="M76 34 Q80 42 77 50" />
      </g>
      <rect x="48" y="82" width="24" height="18" fill="var(--color-insignia-gold, #E8CB5A)" />
      <g fill="none" stroke="var(--color-wt-bg, #171916)" strokeWidth="1.8">
        <rect x="48" y="82" width="24" height="18" /><path d="M48 82 L72 100" /><path d="M72 82 L48 100" />
      </g>
      <g clipPath={`url(#${clipId})`}><g className="insignia__shine"><ShineRect shineId={shineId} /></g></g>
    </g>
  )
}

function ShineRect({ shineId }: { shineId: string }) {
  return <rect x="-50" y="-10" width="34" height="140" fill={`url(#${shineId})`} transform="rotate(20 60 60)" />
}
