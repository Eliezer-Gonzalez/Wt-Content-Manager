import { ArrowRight, Bookmark, Download, Eye, EyeOff, Gamepad2, Shield } from 'lucide-react'
import type { ReactNode } from 'react'
import { PostCard } from './PostCard'
import { PostCardSkeleton } from './PostCardSkeleton'
import { InstalledSkinCard } from './InstalledSkinCard'
import { Button } from './ui/Button'
import type { WtLiveItem } from '../lib/wtLive'
import type { InstalledSkin } from '../lib/localLibrary'
import { SectionHeader } from './HeroBanner'
import type { AppSection } from './NavigationSidebar'
import { formatNumber } from '../lib/format'
import { useI18n } from '../i18n/I18nProvider'
import { useHomeSections, type HomeSectionKey } from '../hooks/useHomeSections'

type Props = {
  items: WtLiveItem[]
  favorites: WtLiveItem[]
  installedSkins: InstalledSkin[]
  favoritesCount: number
  installedCount: number
  gameConfigured: boolean
  loading: boolean
  error: string
  isSaved: (item: WtLiveItem) => boolean
  onNavigate: (section: AppSection) => void
  onOpenGameSetup: () => void
  onRetry: () => void
  onOpen: (item: WtLiveItem) => void
  onToggleSaved: (item: WtLiveItem) => void
  onUninstall: (entry: InstalledSkin) => void
}

type StatusCardProps = {
  icon: ReactNode
  label: string
  value: string
  onClick: () => void
}

const FIVE_CARD_VISIBILITY = ['', 'hidden min-[600px]:block', 'hidden min-[1050px]:block', 'hidden min-[1400px]:block', 'hidden min-[1800px]:block']
const FOUR_CARD_VISIBILITY = ['', 'hidden min-[720px]:block', 'hidden min-[1350px]:block', 'hidden min-[1800px]:block']

function StatusCard({ icon, label, value, onClick }: StatusCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-[76px] items-center gap-3 border border-[#343b32] bg-wt-panel px-4 text-left transition-colors hover:border-[#717d5b] hover:bg-[#252b24] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-olive"
    >
      <span className="grid size-10 shrink-0 place-items-center border border-[#46503f] bg-[#293027] text-[#bdc99e]">{icon}</span>
      <span className="min-w-0">
        <span className="block text-xs text-[#a2aa9c]">{label}</span>
        <strong className="mt-1 block truncate text-sm font-medium text-[#e0e4d8]">{value}</strong>
      </span>
      <ArrowRight size={15} className="ml-auto shrink-0 text-[#88927f]" aria-hidden="true" />
    </button>
  )
}

function HomeRowHeader({
  title, subtitle, showLiveDot, sectionKey, onHide, onSeeAll,
}: {
  title: string; subtitle: string; showLiveDot?: boolean; sectionKey: HomeSectionKey; onHide: (key: HomeSectionKey) => void; onSeeAll: () => void
}) {
  const { t } = useI18n()
  return (
    <div className="mb-4 flex items-end justify-between gap-4">
      <div>
        <h2 className="mb-1 text-lg font-medium tracking-tight text-[#e3e6dc]">{title}</h2>
        <p className="mb-0 text-xs text-[#a1a99b]">
          {subtitle}
          {showLiveDot && <span className="ml-1.5 inline-block size-1.5 rounded-full bg-[#9cae70]" />}
        </p>
      </div>
      <div className="flex items-center gap-1.5">
        <Button variant="quiet" className="min-h-8 px-2 text-xs text-[#959e8f]" onClick={() => onHide(sectionKey)} title={t('homeHideSection')}>
          <EyeOff size={14} aria-hidden="true" />
          <span>{t('homeHide')}</span>
        </Button>
        <Button variant="quiet" className="min-h-9 px-2 text-xs" onClick={onSeeAll}>
          {t('seeAll')} <ArrowRight size={14} aria-hidden="true" />
        </Button>
      </div>
    </div>
  )
}

export function HomeDashboard({
  items, favorites, installedSkins, favoritesCount, installedCount, gameConfigured, loading, error,
  isSaved, onNavigate, onOpenGameSetup, onRetry, onOpen, onToggleSaved, onUninstall,
}: Props) {
  const { t, locale } = useI18n()
  const { visibleSections, hideSection, showSection } = useHomeSections()
  const latest = items.slice(0, 5)
  const latestInstalled = installedSkins.slice(0, 4)
  const latestFavorites = favorites.slice(0, 5)

  const sectionLabels: Record<HomeSectionKey, string> = {
    recent: t('homeLatest'),
    installed: t('homeInstalledTitle'),
    favorites: t('favorites'),
  }
  const hiddenKeys = (['recent', 'installed', 'favorites'] as HomeSectionKey[]).filter(k => !visibleSections[k])

  const renderFivePostRow = (list: WtLiveItem[]) => (
    <div className="grid grid-cols-1 gap-3 min-[600px]:grid-cols-2 min-[1050px]:grid-cols-3 min-[1400px]:grid-cols-4 min-[1800px]:grid-cols-5">
      {list.map((item, index) => (
        <div key={item.id} className={FIVE_CARD_VISIBILITY[index] ?? ''}>
          <PostCard
            item={item}
            isSaved={isSaved(item)}
            isInstalled={installedSkins.some(s => s.item?.id === item.id)}
            masonry={false}
            onOpen={onOpen}
            onToggleSaved={onToggleSaved}
          />
        </div>
      ))}
    </div>
  )

  return (
    <div className="flex-1 px-8 pb-8 pt-8 max-[1100px]:px-6 max-[720px]:px-4 max-[720px]:pt-6">
      <SectionHeader
        variant="radar"
        size="home"
        eyebrow={t('homeOverview')}
        title={t('homeTitle')}
        subtitle={t('homeSubtitle')}
      />

      <section className="mt-5 grid grid-cols-2 gap-3 min-[1500px]:grid-cols-4" aria-label={t('homeQuickAccess')}>
        <StatusCard icon={<Shield size={18} />} label={t('camouflages')} value={t('homeExploreHint')} onClick={() => onNavigate('camouflages')} />
        <StatusCard icon={<Bookmark size={18} />} label={t('favorites')} value={formatNumber(favoritesCount, locale)} onClick={() => onNavigate('favorites')} />
        <StatusCard icon={<Download size={18} />} label={t('downloads')} value={formatNumber(installedCount, locale)} onClick={() => onNavigate('downloads')} />
        <StatusCard icon={<Gamepad2 size={18} />} label={t('game')} value={t(gameConfigured ? 'gameConfigured' : 'gameNotConfigured')} onClick={onOpenGameSetup} />
      </section>

      {hiddenKeys.length > 0 && (
        <div className="mt-6 flex flex-wrap items-center gap-2 border border-[#31382f] bg-[#1c211c] px-3.5 py-2 text-xs text-[#a2aa9c]">
          <span>{t('homeHiddenSections')}</span>
          {hiddenKeys.map(key => (
            <Button key={key} variant="secondary" size="sm" onClick={() => showSection(key)}>
              <Eye size={13} aria-hidden="true" />
              <span>{t('homeShowSection', { section: sectionLabels[key] })}</span>
            </Button>
          ))}
        </div>
      )}

      {visibleSections.recent && (
        <section className="mt-8">
          <HomeRowHeader
            title={t('homeLatest')}
            subtitle={t('updatedFrom')}
            showLiveDot
            sectionKey="recent"
            onHide={hideSection}
            onSeeAll={() => onNavigate('camouflages')}
          />

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
            renderFivePostRow(latest)
          )}
        </section>
      )}

      {visibleSections.installed && latestInstalled.length > 0 && (
        <section className="mt-8">
          <HomeRowHeader
            title={t('homeInstalledTitle')}
            subtitle={t('homeInstalledSubtitle')}
            sectionKey="installed"
            onHide={hideSection}
            onSeeAll={() => onNavigate('downloads')}
          />
          <div className="grid grid-cols-1 gap-3 min-[720px]:grid-cols-2 min-[1350px]:grid-cols-3 min-[1800px]:grid-cols-4">
            {latestInstalled.map((entry, index) => (
              <div key={entry.path} className={FOUR_CARD_VISIBILITY[index] ?? ''}>
                <InstalledSkinCard
                  entry={entry}
                  onOpen={onOpen}
                  onUninstall={onUninstall}
                />
              </div>
            ))}
          </div>
        </section>
      )}

      {visibleSections.favorites && latestFavorites.length > 0 && (
        <section className="mt-8">
          <HomeRowHeader
            title={t('favorites')}
            subtitle={t('homeFavoritesSubtitle')}
            sectionKey="favorites"
            onHide={hideSection}
            onSeeAll={() => onNavigate('favorites')}
          />
          {renderFivePostRow(latestFavorites)}
        </section>
      )}
    </div>
  )
}
