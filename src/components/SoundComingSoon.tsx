import type { CSSProperties } from 'react'
import { SectionHeader } from './HeroBanner'
import { useI18n } from '../i18n/I18nProvider'

const smallSparks = [
  { r: 2.5, fill: '#f2b84b', dx: '-74px', dy: '-44px' },
  { r: 2, fill: '#ffd98a', dx: '-46px', dy: '-72px' },
  { r: 3, fill: '#e8833a', dx: '-16px', dy: '-84px' },
  { r: 2, fill: '#f2b84b', dx: '22px', dy: '-80px' },
  { r: 2.5, fill: '#ffd98a', dx: '56px', dy: '-60px' },
  { r: 3, fill: '#e8833a', dx: '88px', dy: '-30px' },
  { r: 2, fill: '#ffd98a', dx: '-100px', dy: '-16px' },
  { r: 2, fill: '#f2b84b', dx: '116px', dy: '-6px' },
]

const glowSparks = [
  { r: 4.5, fill: '#fff1c2', dx: '-60px', dy: '-98px' },
  { r: 4, fill: '#ffd98a', dx: '36px', dy: '-104px' },
  { r: 5, fill: '#fff1c2', dx: '82px', dy: '-74px' },
  { r: 3.5, fill: '#f2b84b', dx: '-124px', dy: '-42px' },
  { r: 4, fill: '#ffd98a', dx: '136px', dy: '-26px' },
  { r: 4.5, fill: '#fff1c2', dx: '2px', dy: '-114px' },
]

export function SoundComingSoon() {
  const { t } = useI18n()
  return (
    <div className="flex w-full flex-1 flex-col px-8 pb-5 pt-8 max-[1100px]:px-6 max-[720px]:px-4 max-[720px]:pt-6">
      <SectionHeader
        variant="radar"
        size="catalog"
        eyebrow={t('communityContent')}
        titleHighlight={t('sounds')}
      />
      <section className="grid flex-1 place-items-center px-6 py-12 text-center">
        <div className="flex w-full max-w-[560px] flex-col items-center gap-6 text-[#bdc99e]">
          <div className="relative w-full">
          <svg
            width="100%"
            viewBox="0 0 680 320"
            role="img"
            className="sound-scene h-auto w-full select-none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <title>{t('soundIllustrationTitle')}</title>
            <desc>{t('soundIllustrationDesc')}</desc>
            <defs>
              <clipPath id="strip">
                <rect x="140" y="271" width="400" height="10" />
              </clipPath>
            </defs>
            <style>
              {`
                .sound-scene { --t: 2.6s; }

                /* ===== Martillo: pivota desde el extremo del mango ===== */
                .sound-hammer { transform-origin: 490px 173px; animation: sound-swing var(--t) infinite; }
                @keyframes sound-swing {
                  0%, 6%  { transform: rotate(0deg);  animation-timing-function: ease-in-out; }
                  48%     { transform: rotate(40deg); animation-timing-function: ease-out; }
                  58%     { transform: rotate(43deg); animation-timing-function: cubic-bezier(.6,0,.9,.4); }
                  66%     { transform: rotate(0deg);  animation-timing-function: ease-out; }
                  70%     { transform: rotate(5deg);  animation-timing-function: ease-in; }
                  74%, 100% { transform: rotate(0deg); }
                }

                /* ===== Yunque: pequeña sacudida al impacto ===== */
                .sound-anvil { animation: sound-jolt var(--t) infinite; }
                @keyframes sound-jolt {
                  0%, 65.9% { transform: translateY(0); }
                  67.5%     { transform: translateY(2.5px); }
                  72%, 100% { transform: translateY(0); }
                }

                /* ===== Destello del impacto ===== */
                .sound-flash { transform-origin: 296px 199px; transform-box: view-box; opacity: 0; animation: sound-flash var(--t) infinite; }
                @keyframes sound-flash {
                  0%, 65.9% { opacity: 0; transform: scale(.2); }
                  66.5%     { opacity: 1; transform: scale(1); }
                  73%, 100% { opacity: 0; transform: scale(2); }
                }

                /* ===== Chispas: abanico con gravedad ===== */
                .sound-sparks circle { opacity: 0; animation: sound-spark var(--t) infinite; }
                .sound-sparks.glow { filter: drop-shadow(0 0 4px #f2b84b); }
                @keyframes sound-spark {
                  0%, 65.9% { opacity: 0; transform: translate(0, 0) scale(1); }
                  66%       { opacity: 1; transform: translate(0, 0) scale(1); animation-timing-function: cubic-bezier(.1,.7,.3,1); }
                  78%       { opacity: 1; transform: translate(calc(var(--dx) * .75), var(--dy)); animation-timing-function: cubic-bezier(.5,0,.9,.6); }
                  96%       { opacity: 0; transform: translate(var(--dx), calc(var(--dy) + 120px)) scale(.3); }
                  100%      { opacity: 0; transform: translate(var(--dx), calc(var(--dy) + 120px)) scale(.3); }
                }

                /* ===== Mira: pulsa y se cierra en el impacto ===== */
                .sound-reticle { transform-origin: 296px 198px; animation: sound-lock var(--t) infinite; }
                @keyframes sound-lock {
                  0%, 48%   { opacity: .25; transform: scale(1.15); }
                  58%       { opacity: .65; transform: scale(1); }
                  66%       { opacity: 1;   transform: scale(.82); }
                  76%       { opacity: .5;  transform: scale(1); }
                  100%      { opacity: .25; transform: scale(1.15); }
                }
                .sound-reticle-ring { transform-origin: 296px 198px; animation: sound-spin 8s linear infinite; }
                @keyframes sound-spin { to { transform: rotate(360deg); } }

                /* ===== Franja de peligro: se ilumina con el golpe ===== */
                .sound-chevrons { animation: sound-strip var(--t) infinite; }
                @keyframes sound-strip {
                  0%, 65.9% { fill: #6f7d52; }
                  67%       { fill: #b4c882; }
                  78%, 100% { fill: #6f7d52; }
                }

                @media (prefers-reduced-motion: reduce) {
                  .sound-hammer, .sound-anvil, .sound-flash, .sound-sparks circle, .sound-reticle, .sound-reticle-ring, .sound-chevrons { animation: none !important; }
                }
              `}
            </style>

            {/* Esquinas del marco */}
            <path
              d="M130 44V20H154M526 20H550V44M130 276V300H154M526 300H550V276"
              fill="none"
              stroke="#59654d"
              strokeWidth={2}
              strokeLinecap="square"
            />

            {/* Franja de peligro */}
            <g clipPath="url(#strip)">
              <rect x="140" y="271" width="400" height="10" fill="#262b20" />
              <path
                className="sound-chevrons"
                fill="#6f7d52"
                d="M150 271h10l-10 10h-10z m20 0h10l-10 10h-10z m20 0h10l-10 10h-10z m20 0h10l-10 10h-10z m20 0h10l-10 10h-10z m20 0h10l-10 10h-10z m20 0h10l-10 10h-10z m20 0h10l-10 10h-10z m20 0h10l-10 10h-10z m20 0h10l-10 10h-10z m20 0h10l-10 10h-10z m20 0h10l-10 10h-10z m20 0h10l-10 10h-10z m20 0h10l-10 10h-10z m20 0h10l-10 10h-10z m20 0h10l-10 10h-10z m20 0h10l-10 10h-10z m20 0h10l-10 10h-10z m20 0h10l-10 10h-10z m20 0h10l-10 10h-10z m20 0h10l-10 10h-10z"
              />
            </g>

            {/* Yunque */}
            <g className="sound-anvil">
              <path d="M246 226 L346 226 L336 248 L256 248 Z" fill="#3b4148" />
              <polygon
                points="296,230 297.7,234.65 302.66,234.84 298.76,237.9 300.11,242.66 296,239.9 291.89,242.66 293.24,237.9 289.34,234.84 294.3,234.65"
                fill="#8a9868"
              />
              <rect x="230" y="248" width="132" height="22" rx="3" fill="#444b53" />
              <circle cx="241" cy="259" r="2.2" fill="#6b7580" />
              <circle cx="351" cy="259" r="2.2" fill="#6b7580" />
              <g>
                <path d="M232 200 L186 204 Q172 208 172 214 Q172 220 186 224 L232 226 Z" fill="#4e565f" />
                <rect x="232" y="200" width="128" height="26" rx="3" fill="#4e565f" />
                <rect x="236" y="201" width="120" height="3" rx="1.5" fill="#8a9868" />
              </g>
            </g>

            {/* Mira */}
            <g className="sound-reticle" fill="none" stroke="#bdc99e" strokeWidth={1.5}>
              <circle className="sound-reticle-ring" cx="296" cy="198" r="22" strokeDasharray="5 4" />
              <path d="M296 168v10M296 218v10M266 198h10M316 198h10" />
            </g>

            {/* Destello del impacto */}
            <circle className="sound-flash" cx="296" cy="199" r="14" fill="#ffd98a" />

            {/* Martillo */}
            <g className="sound-hammer">
              <rect x="300" y="167" width="190" height="12" rx="6" fill="#6b7a4b" />
              <rect x="424" y="167" width="66" height="12" rx="6" fill="#3d4630" />
              <path d="M436 167l-6 12M448 167l-6 12M460 167l-6 12" stroke="#8a9868" strokeWidth={1.5} />
              <rect x="281" y="146" width="30" height="54" rx="3" fill="#6c7680" />
              <rect x="281" y="146" width="30" height="8" rx="2" fill="#8b96a0" />
              <rect x="281" y="192" width="30" height="8" rx="2" fill="#8b96a0" />
              <rect x="279" y="165" width="34" height="16" rx="2" fill="#59654d" />
            </g>

            {/* Chispas pequeñas */}
            <g className="sound-sparks">
              {smallSparks.map((spark, idx) => (
                <circle
                  key={idx}
                  cx="296"
                  cy="197"
                  r={spark.r}
                  fill={spark.fill}
                  style={{ '--dx': spark.dx, '--dy': spark.dy } as CSSProperties}
                />
              ))}
            </g>

            {/* Chispas grandes y brillantes */}
            <g className="sound-sparks glow">
              {glowSparks.map((spark, idx) => (
                <circle
                  key={idx}
                  cx="296"
                  cy="197"
                  r={spark.r}
                  fill={spark.fill}
                  style={{ '--dx': spark.dx, '--dy': spark.dy } as CSSProperties}
                />
              ))}
            </g>
          </svg>
          </div>

          <h1 className="m-0 font-display text-4xl font-semibold tracking-wide text-[#e6e7dd]">
            {t('underConstruction')}
          </h1>
        </div>
      </section>
    </div>
  )
}

