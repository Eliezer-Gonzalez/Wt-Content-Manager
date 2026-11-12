import { useAutoLoadMore } from '../hooks/useAutoLoadMore'
import { useI18n } from '../i18n/I18nProvider'
import type { SkinInstaller } from '../hooks/useSkinInstaller'
import type { useCamouflageFeed } from '../hooks/useCamouflageFeed'
import type { WtLiveItem } from '../lib/wtLive'
import { Button } from './ui/Button'
import { MasonryPostGrid } from './MasonryPostGrid'
import { PostCard } from './PostCard'
import { PostCardSkeleton } from './PostCardSkeleton'

type Feed = ReturnType<typeof useCamouflageFeed>
type Installer = Pick<SkinInstaller, 'activeLangGroup' | 'installing' | 'progress' | 'paused' | 'cancelling' | 'togglePause'>

type Props = {
  feed: Feed
  enabled: boolean
  installedIds: ReadonlySet<number>
  installer: Installer
  isSaved: (item: WtLiveItem) => boolean
  onCancelDownload: () => void
  onOpen: (item: WtLiveItem) => void
  onToggleSaved: (item: WtLiveItem) => void
}

export function CamouflageFeedSection({
  feed, enabled, installedIds, installer, isSaved, onCancelDownload, onOpen, onToggleSaved,
}: Props) {
  const { t } = useI18n()
  const loadMoreRef = useAutoLoadMore({
    enabled: enabled && feed.hasNext && !feed.loading && !feed.loadingMore && !feed.loadMoreError &&
      feed.items.length > 0 && feed.items.length % 150 !== 0,
    onLoadMore: feed.loadMore,
  })

  if (feed.error) return (
    <div className="grid min-h-40 place-items-center text-center">
      <div><p className="text-sm text-[#c2c8bb]">{feed.error}</p><Button variant="primary" onClick={feed.retry}>{t('retry')}</Button></div>
    </div>
  )
  if (feed.loading) return <PostCardSkeleton label={t('loading')} />
  if (feed.items.length === 0) return <div className="grid min-h-40 place-items-center text-center text-sm text-[#b1b7ab]">{t('notFound')}</div>

  return (
    <>
      <MasonryPostGrid
        items={feed.items}
        renderItem={item => (
          <PostCard
            item={item}
            isSaved={isSaved(item)}
            isInstalled={installedIds.has(item.id)}
            skinProgress={installer.activeLangGroup === item.langGroup && installer.installing
              ? { ...(installer.progress ?? { phase: 'preparing' as const, downloadedBytes: 0, totalBytes: null, paused: false }), paused: installer.paused }
              : null}
            cancellingDownload={installer.cancelling}
            onToggleDownloadPause={() => void installer.togglePause()}
            onCancelDownload={onCancelDownload}
            onOpen={onOpen}
            onToggleSaved={onToggleSaved}
          />
        )}
      />
      {(feed.loadMoreError || feed.hasNext || feed.loadingMore) && (
        <div className="mt-4 flex min-h-6 items-center justify-center">
          {feed.loadMoreError && <p className="mb-0 text-center text-sm text-amber-200" role="alert">{feed.loadMoreError}</p>}
        </div>
      )}
      {(feed.hasNext || feed.loadingMore) && (
        <div ref={loadMoreRef} className="mt-5 flex justify-center">
          <Button variant="quiet" disabled={feed.loadingMore} onClick={() => (feed.loadMoreError ? feed.retry() : feed.loadMore())}>
            {feed.loadingMore ? t('loadingMore') : t(feed.loadMoreError ? 'retry' : 'loadMore')}
          </Button>
        </div>
      )}
    </>
  )
}
