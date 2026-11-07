import { ArrowRight, Bookmark, Download, Gamepad2, Shield } from 'lucide-react'
import type { ReactNode } from 'react'
import { MasonryPostGrid } from './MasonryPostGrid'
import { PostCard } from './PostCard'
import { PostCardSkeleton } from './PostCardSkeleton'
import { Button } from './ui/Button'
import type { WtLiveItem } from '../wtLive'
import { WT_LIVE_HEADER_IMAGE } from '../lib/wtLiveAssets'
import { formatNumber } from '../lib/format'
import type { TranslationKey, TranslationParams } from '../i18n/I18nProvider'

type Props = {
  items: WtLiveItem[]
  favoritesCount: number
  installedCount: number
  gameConfigured: boolean
  loading: boolean
  error: string
  locale: string
  t: (key: TranslationKey, params?: TranslationParams) => string
  isSaved: (item: WtLiveItem) => boolean
  onNavigate: (section: string) => void
  onOpenGameSetup: () => void
  onRetry: () => void
  onOpen: (item: WtLiveItem) => void
  onToggleSaved: (item: WtLiveItem) => void
}

type StatusCardProps = {
  icon: ReactNode
  label: string
  value: string
  onClick: () => void
}

function StatusCard({ icon, label, value, onClick }: StatusCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-[76px] items-center gap-3 border border-[#343b32] bg-wt-panel px-4 text-left transition-colors hover:border-[#717d5b] hover:bg-[#252b24] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-olive"
    >
      <span className="grid size-10 shrink-0 place-items-center border border-[#46503f] bg-[#293027] text-[#bdc99e]">
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block text-xs text-[#a2aa9c]">{label}</span>
        <strong className="mt-1 block truncate text-sm font-medium text-[#e0e4d8]">{value}</strong>
      </span>
      <ArrowRight size={15} className="ml-auto shrink-0 text-[#88927f]" aria-hidden="true" />
    </button>
  )
}

export function HomeDashboard({
  items,
  favoritesCount,
  installedCount,
  gameConfigured,
  loading,
  error,
  locale,
  t,
  isSaved,
  onNavigate,
  onOpenGameSetup,
  onRetry,
  onOpen,
  onToggleSaved,
}: Props) {
  const latest = items.slice(0, 4)

  return (
    <div className="flex-1 px-8 pb-8 pt-8 max-[1100px]:px-6 max-[720px]:px-4 max-[720px]:pt-6">
      <section className="relative flex min-h-[190px] items-center border-b border-[#31372f] px-[3px] pb-6 max-[720px]:min-h-[165px]">
        <div
          className="pointer-events-none absolute -top-8 right-0 bottom-0 w-[68%] overflow-hidden max-[720px]:w-[80%]"
          aria-hidden="true"
        >
          <img
            src={WT_LIVE_HEADER_IMAGE}
            alt=""
            className="size-full origin-left scale-[1.2] object-cover object-[82%_48%] opacity-85"
          />
          <span className="absolute inset-0 bg-gradient-to-r from-wt-bg/95 via-wt-bg/55 to-wt-bg/10" />
          <span className="absolute inset-0 bg-gradient-to-b from-wt-bg/5 via-transparent to-wt-bg/15" />
        </div>
        <div className="relative z-10 max-w-2xl">
          <p className="mb-0 flex items-center gap-2 text-[10px] tracking-[.14em] text-[#a0aa8a]">
            <span className="h-px w-3.5 bg-[#acb98b]" />
            {t('homeOverview')}
          </p>
          <h1 className="mb-3 mt-4 font-display text-[48px] font-semibold leading-none tracking-[-.02em] text-[#e6e7dd] max-[720px]:text-[38px]">
            {t('homeTitle')}
          </h1>
          <p className="mb-0 max-w-[42ch] text-sm leading-6 text-[#c0c5bb]">{t('homeSubtitle')}</p>
        </div>
      </section>

      <section
        className="mt-5 grid grid-cols-2 gap-3 min-[1500px]:grid-cols-4"
        aria-label={t('homeQuickAccess')}
      >
        <StatusCard
          icon={<Shield size={18} />}
          label={t('camouflages')}
          value={t('homeExploreHint')}
          onClick={() => onNavigate('camouflages')}
        />
        <StatusCard
          icon={<Bookmark size={18} />}
          label={t('favorites')}
          value={formatNumber(favoritesCount, locale)}
          onClick={() => onNavigate('favorites')}
        />
        <StatusCard
          icon={<Download size={18} />}
          label={t('downloads')}
          value={formatNumber(installedCount, locale)}
          onClick={() => onNavigate('downloads')}
        />
        <StatusCard
          icon={<Gamepad2 size={18} />}
          label={t('game')}
          value={t(gameConfigured ? 'gameConfigured' : 'gameNotConfigured')}
          onClick={onOpenGameSetup}
        />
      </section>

      <section className="mt-8">
        <div className="mb-4 flex items-end justify-between gap-4">
          <div>
            <h2 className="mb-1 text-lg font-medium tracking-tight text-[#e3e6dc]">{t('homeLatest')}</h2>
            <p className="mb-0 text-xs text-[#a1a99b]">
              {t('updatedFrom')}{' '}
              <span className="ml-1 inline-block size-1.5 rounded-full bg-[#9cae70]" />
            </p>
          </div>
          <Button variant="quiet" className="min-h-9 px-2 text-xs" onClick={() => onNavigate('camouflages')}>
            {t('seeAll')} <ArrowRight size={14} />
          </Button>
        </div>

        {error ? (
          <div className="grid min-h-40 place-items-center text-center">
            <div>
              <p className="text-sm text-[#c2c8bb]">{error}</p>
              <Button variant="primary" onClick={onRetry}>
                {t('retry')}
              </Button>
            </div>
          </div>
        ) : loading ? (
          <PostCardSkeleton label={t('loading')} />
        ) : latest.length === 0 ? (
          <p className="py-10 text-center text-sm text-[#aeb5a7]">{t('notFound')}</p>
        ) : (
          <MasonryPostGrid
            items={latest}
            renderItem={item => (
              <PostCard
                key={item.id}
                item={item}
                locale={locale}
                masonry
                isSaved={isSaved(item)}
                t={t}
                onOpen={onOpen}
                onToggleSaved={onToggleSaved}
              />
            )}
          />
        )}
      </section>
    </div>
  )
}
