import { useMemo, useState, type RefObject } from 'react'
import { ChevronDown, Search, Volume2 } from 'lucide-react'
import { Button } from './ui/Button'
import { MasonryPostGrid } from './MasonryPostGrid'
import { PeriodFilter } from './PeriodFilter'
import { PostCard } from './PostCard'
import { PostCardSkeleton } from './PostCardSkeleton'
import { SectionHeader } from './HeroBanner'
import { SoundHammerAnimation } from './SoundHammerAnimation'
import { SoundPostDetailDialog } from './SoundPostDetailDialog'
import { usePostDetail } from '../hooks/usePostDetail'
import { useAutoLoadMore } from '../hooks/useAutoLoadMore'
import { useSoundFeed } from '../hooks/useSoundFeed'
import type { SoundLibraryController } from '../hooks/useSoundLibrary'
import { useI18n } from '../i18n/I18nProvider'
import { isTauriRuntime } from '../lib/gameInstall'
import type { WtLiveFeedSort, WtLiveItem } from '../lib/wtLive'
import type { ImageQualityMode } from '../lib/imageQuality'

type Props = {
  imageQuality: ImageQualityMode
  soundLibrary: SoundLibraryController
  searchInputRef: RefObject<HTMLInputElement | null>
  query: string
  onQueryChange: (value: string) => void
  isSaved: (item: WtLiveItem) => boolean
  onToggleSaved: (item: WtLiveItem) => void
}

export function SoundManagerPage({ imageQuality, soundLibrary, searchInputRef, query, onQueryChange, isSaved, onToggleSaved }: Props) {
  const { t } = useI18n()
  const [sort, setSort] = useState<WtLiveFeedSort>('created')
  const feed = useSoundFeed(query, sort)
  const postDetail = usePostDetail()
  const downloadedLangGroups = useMemo(() => new Set(soundLibrary.packages.map(packageInfo => packageInfo.langGroup)), [soundLibrary.packages])

  const canDownloadMore = feed.hasNext && !feed.loading && !feed.loadingMore && !feed.loadMoreError
  const feedLoadMoreRef = useAutoLoadMore({
    enabled: canDownloadMore && feed.items.length > 0,
    onLoadMore: feed.loadMore,
  })

  function searchHashtag(tag: string) {
    const nextQuery = `#${tag}`
    onQueryChange(nextQuery)
    feed.loadFirstPage()
    postDetail.closePost()
  }

  return (
    <div className="flex w-full flex-1 flex-col px-8 pb-5 pt-8 max-[1100px]:px-6 max-[720px]:px-4 max-[720px]:pt-6">
      <SectionHeader
        variant="radar"
        size="catalog"
        eyebrow={t('communityContent')}
        titleHighlight={t('sounds')}
        subtitle={t('recentSubtitle')}
      />

      <section className="my-5 flex items-center justify-between gap-4 border border-[#343b32] bg-[#20261f] px-4 py-2.5 max-[720px]:px-3" aria-label={t('soundManualActivationTitle')}>
        <div className="flex min-w-0 items-start gap-3 text-sm text-[#c0c5bb]">
          <Volume2 size={17} className="mt-0.5 shrink-0 text-[#bdc99e]" aria-hidden="true" />
          <div>
            <p className="mb-0 font-medium text-[#d8dfcb]">{t('soundManualActivationTitle')}</p>
            <p className="mb-0 mt-1 text-xs leading-5 text-[#aab2a4]">{t('soundManualActivation')}</p>
          </div>
        </div>
        <div className="w-[170px] shrink-0 max-[720px]:hidden">
          <SoundHammerAnimation label={t('soundIllustrationTitle')} description={t('soundIllustrationDesc')} />
        </div>
      </section>

      <section className="my-[18px] flex flex-wrap items-center gap-2.5 max-[720px]:mt-3" aria-label={t('catalogControls')}>
        <label className="flex h-11 min-w-[240px] max-w-[490px] flex-1 items-center gap-2.5 border border-[#343b32] bg-wt-panel px-3 text-[#a0aa9b] focus-within:border-[#717d5b]">
          <Search size={17} aria-hidden="true" />
          <input ref={searchInputRef} className="min-w-0 flex-1 bg-transparent text-sm text-[#e2e5db] outline-none placeholder:text-[#929a8e]" value={query} onChange={event => onQueryChange(event.target.value)} placeholder={t('searchPlaceholder')} />
        </label>
        <PeriodFilter value={feed.period} onChange={feed.changePeriod} />
        <Button variant="quiet" className="min-h-11 px-3 text-xs" onClick={() => { setSort(value => value === 'created' ? 'rating' : 'created'); feed.loadFirstPage() }}>
          {t(sort === 'created' ? 'recent' : 'popular')}<ChevronDown size={14} aria-hidden="true" />
        </Button>
      </section>

      <div className="mb-3.5 mt-3 flex min-h-6 items-center gap-2 text-xs text-[#a1a99b]">
        <span>{feed.loading ? t('loading') : t(feed.online ? 'updatedFrom' : 'offlineSource')}</span>
        <span className={`inline-block size-1.5 ${feed.online ? 'bg-[#9cae70]' : 'bg-[#788078]'}`} aria-hidden="true" />
        <span className="ml-auto">{t('posts', { count: feed.items.length })}</span>
      </div>

      {feed.error ? (
        <div className="grid min-h-40 place-items-center text-center">
          <div><p className="text-sm text-[#c2c8bb]">{feed.error}</p><Button variant="primary" onClick={feed.retry}>{t('retry')}</Button></div>
        </div>
      ) : feed.loading ? <PostCardSkeleton label={t('loading')} /> : feed.items.length === 0 ? (
        <div className="grid min-h-40 place-items-center text-center text-sm text-[#b1b7ab]">{t('notFound')}</div>
      ) : (
        <>
          <MasonryPostGrid
            items={feed.items}
            renderItem={item => (
              <PostCard
                item={item}
                contentType="sound"
                isSaved={isSaved(item)}
                isDownloaded={downloadedLangGroups.has(item.langGroup)}
                isInstalled={soundLibrary.packages.some(packageInfo => packageInfo.langGroup === item.langGroup && packageInfo.id === soundLibrary.status?.activePackageId)}
                onOpen={postDetail.openPost}
                onToggleSaved={itemToSave => onToggleSaved({ ...itemToSave, contentType: 'sound' })}
              />
            )}
          />
          {feed.loadMoreError && <p className="mt-4 text-center text-sm text-amber-200" role="alert">{feed.loadMoreError}</p>}
          {(canDownloadMore || feed.loadingMore || feed.loadMoreError) && (
            <div ref={feedLoadMoreRef} className="mt-5 flex justify-center">
              <Button variant="quiet" disabled={feed.loadingMore} onClick={() => feed.loadMoreError ? feed.retry() : feed.loadMore()}>
                {feed.loadingMore ? t('loadingMore') : t(feed.loadMoreError ? 'retry' : 'loadMore')}
              </Button>
            </div>
          )}
        </>
      )}

      {postDetail.selected && (
        <SoundPostDetailDialog
          item={postDetail.selected}
          detail={postDetail.detail}
          loading={postDetail.detailLoading}
          error={postDetail.detailError}
          imageQuality={imageQuality}
          canDownload={isTauriRuntime}
          downloadedLangGroups={downloadedLangGroups}
          downloadBusy={soundLibrary.downloadingId != null}
          downloadingId={soundLibrary.downloadingId}
          progress={soundLibrary.downloadProgress
            ? { ...soundLibrary.downloadProgress, paused: soundLibrary.paused }
            : null}
          downloadError={soundLibrary.error}
          onDownload={item => void soundLibrary.download(item)}
          onTogglePause={() => void soundLibrary.togglePause()}
          onCancel={() => void soundLibrary.cancelDownload()}
          onSearchHashtag={searchHashtag}
          onClose={postDetail.closePost}
        />
      )}

    </div>
  )
}
