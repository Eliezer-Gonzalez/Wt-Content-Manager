import type { RefObject } from 'react'
import { ChevronDown, Search } from 'lucide-react'
import { CamouflageFeedSection } from './CamouflageFeedSection'
import { SectionHeader } from './HeroBanner'
import { PeriodFilter } from './PeriodFilter'
import { Button } from './ui/Button'
import { useI18n } from '../i18n/I18nContext'
import type { useCamouflageFeed } from '../hooks/useCamouflageFeed'
import type { SkinInstaller } from '../hooks/useSkinInstaller'
import type { WtLiveItem } from '../lib/wtLive'

const isApple = typeof navigator !== 'undefined' && /(Mac|iPhone|iPod|iPad)/i.test(navigator.userAgent || navigator.platform || '')

type Feed = ReturnType<typeof useCamouflageFeed>
type Installer = Pick<SkinInstaller, 'activeLangGroup' | 'installing' | 'progress' | 'paused' | 'cancelling' | 'togglePause'>

type Props = {
  feed: Feed
  query: string
  sort: 'recent' | 'popular'
  searchInputRef: RefObject<HTMLInputElement | null>
  installedIds: ReadonlySet<number>
  installer: Installer
  isSaved: (item: WtLiveItem) => boolean
  onQueryChange: (value: string) => void
  onToggleSort: () => void
  onCancelDownload: () => void
  onOpen: (item: WtLiveItem) => void
  onToggleSaved: (item: WtLiveItem) => void
}

export function CamouflagesPage({
  feed,
  query,
  sort,
  searchInputRef,
  installedIds,
  installer,
  isSaved,
  onQueryChange,
  onToggleSort,
  onCancelDownload,
  onOpen,
  onToggleSaved,
}: Props) {
  const { t } = useI18n()

  return (
    <div className="flex w-full flex-1 flex-col px-8 pb-5 pt-8 max-[1100px]:px-6 max-[720px]:px-4 max-[720px]:pt-6">
      <SectionHeader
        variant="radar"
        size="catalog"
        eyebrow={t('communityContent')}
        titlePrefix={t('recentTitlePrefix')}
        titleHighlight={t('recentTitleHighlight')}
        subtitle={t('recentSubtitle')}
      />

      <section className="my-[22px] mb-[31px] flex flex-wrap items-center gap-2.5 max-[720px]:mb-6 max-[720px]:mt-[17px]">
        <label className="flex h-11 min-w-[240px] max-w-[490px] flex-1 items-center gap-2.5 border border-[#343b32] bg-wt-panel px-3 text-[#a0aa9b] focus-within:border-[#717d5b]">
          <Search size={17} />
          <input
            ref={searchInputRef}
            className="min-w-0 flex-1 bg-transparent text-sm text-[#e2e5db] outline-none placeholder:text-[#929a8e]"
            value={query}
            onChange={event => onQueryChange(event.target.value)}
            placeholder={t('searchPlaceholder')}
          />
          <kbd className="border border-[#41483d] px-1.5 py-0.5 text-[10px] text-[#929a8e] max-[720px]:hidden">
            {isApple ? '⌘ K' : 'Ctrl K'}
          </kbd>
        </label>
        <div className="flex flex-wrap items-center gap-2.5">
          <PeriodFilter value={feed.period} onChange={feed.changePeriod} />
          <Button variant="quiet" className="min-h-11 px-3 text-xs" onClick={onToggleSort}>
            {t(sort)}<ChevronDown size={14} aria-hidden="true" />
          </Button>
        </div>
      </section>

      <div className="flex min-h-6 items-center">
        <p className="mb-0 flex items-center gap-2 text-xs text-[#a1a99b]">
          {feed.loading ? t('loading') : (
            <>
              {t(feed.online ? 'updatedFrom' : 'offlineSource')}
              {' '}
              <span className={`inline-block size-1.5 rounded-full ${feed.online ? 'bg-[#9cae70]' : 'bg-[#788078]'}`} />
            </>
          )}
        </p>
      </div>
      <div className="mb-3.5 mt-5 flex items-center gap-2">
        <span className="ml-auto text-[11px] text-[#929a8e]">{t('posts', { count: feed.items.length })}</span>
      </div>

      <CamouflageFeedSection
        feed={feed}
        enabled
        installedIds={installedIds}
        installer={installer}
        isSaved={isSaved}
        onCancelDownload={onCancelDownload}
        onOpen={onOpen}
        onToggleSaved={onToggleSaved}
      />
    </div>
  )
}
