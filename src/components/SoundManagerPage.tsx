import { useState } from 'react'
import { ChevronDown, HardDrive, RefreshCw, Search, Volume2 } from 'lucide-react'
import { Button } from './ui/Button'
import { MasonryPostGrid } from './MasonryPostGrid'
import { PeriodFilter } from './PeriodFilter'
import { PostCard } from './PostCard'
import { PostCardSkeleton } from './PostCardSkeleton'
import { SectionHeader } from './HeroBanner'
import { SoundActionConfirmDialog } from './SoundActionConfirmDialog'
import { SoundHammerAnimation } from './SoundHammerAnimation'
import { SoundPackageCard } from './SoundPackageCard'
import { SoundPostDetailDialog } from './SoundPostDetailDialog'
import { usePostDetail } from '../hooks/usePostDetail'
import { useAutoLoadMore } from '../hooks/useAutoLoadMore'
import { useSoundFeed } from '../hooks/useSoundFeed'
import { useSoundLibrary } from '../hooks/useSoundLibrary'
import { useI18n } from '../i18n/I18nProvider'
import { isTauriRuntime } from '../lib/gameInstall'
import { formatFileSize } from '../lib/format'
import type { SoundPackage } from '../lib/sounds'
import type { WtLiveFeedSort } from '../lib/wtLive'
import type { ImageQualityMode } from '../lib/imageQuality'

type Props = {
  gamePath?: string
  imageQuality: ImageQualityMode
  onChooseGame: () => void
}

export function SoundManagerPage({ gamePath, imageQuality, onChooseGame }: Props) {
  const { t, locale } = useI18n()
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<WtLiveFeedSort>('created')
  const [pendingInstall, setPendingInstall] = useState<SoundPackage | null>(null)
  const [confirmRestore, setConfirmRestore] = useState(false)
  const feed = useSoundFeed(query, sort)
  const library = useSoundLibrary(gamePath)
  const postDetail = usePostDetail()
  const activePackage = library.packages.find(packageInfo => packageInfo.id === library.status?.activePackageId)
  const gameReady = Boolean(gamePath && !library.statusLoading && library.status?.processStatus === 'stopped')
  const busy = Boolean(library.installingId || library.restoring)
  const downloadedLangGroups = new Set(library.packages.map(packageInfo => packageInfo.langGroup))

  const canDownloadMore = feed.hasNext && !feed.loading && !feed.loadingMore && !feed.loadMoreError
  const feedLoadMoreRef = useAutoLoadMore({
    enabled: canDownloadMore && feed.items.length > 0,
    onLoadMore: feed.loadMore,
  })

  async function confirmSoundAction() {
    if (pendingInstall) {
      await library.install(pendingInstall.id)
      setPendingInstall(null)
    } else if (confirmRestore) {
      await library.restore()
      setConfirmRestore(false)
    }
  }

  function searchHashtag(tag: string) {
    const nextQuery = `#${tag}`
    setQuery(nextQuery)
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
          <input className="min-w-0 flex-1 bg-transparent text-sm text-[#e2e5db] outline-none placeholder:text-[#929a8e]" value={query} onChange={event => setQuery(event.target.value)} placeholder={t('searchPlaceholder')} />
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
                showSave={false}
                isSaved={false}
                isInstalled={library.packages.some(packageInfo => packageInfo.langGroup === item.langGroup && packageInfo.id === library.status?.activePackageId)}
                onOpen={postDetail.openPost}
                onToggleSaved={() => undefined}
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

      <section className="mt-10 border-t border-[#30372f] pt-6" aria-labelledby="sound-library-title">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <div className="min-w-0 flex-1">
            <h2 id="sound-library-title" className="m-0 font-display text-2xl font-semibold text-[#e1e4d9]">{t('soundLibrary')}</h2>
            <p className="mb-0 mt-1 text-xs text-[#9fa89b]">{t('soundLibraryDescription')}</p>
          </div>
          <Button size="sm" variant="quiet" onClick={() => void library.refreshPackages()} disabled={library.loading} aria-label={t('refreshSoundLibrary')}>
            <RefreshCw size={14} className={library.loading ? 'animate-spin motion-reduce:animate-none' : ''} aria-hidden="true" />{t('refreshSoundLibrary')}
          </Button>
        </div>

        <div className="mb-4 flex flex-wrap items-center gap-2 border border-[#343b32] bg-[#1d231d] px-3 py-3 text-xs text-[#bac2b0]">
          <HardDrive size={15} className="text-[#aeb990]" aria-hidden="true" />
          {gamePath ? (
            <>
              <span>{t('soundGameStatus')}: {t(library.status?.processStatus === 'running' ? 'soundProcessRunning' : library.status?.processStatus === 'stopped' ? 'soundProcessStopped' : 'soundProcessUnknown')}</span>
              <span className="text-[#798473]">·</span>
              <span>{t('soundInstalledBanks', { count: library.status?.installedBanks ?? 0 })}</span>
              <Button size="sm" variant="quiet" className="ml-auto" onClick={() => void library.refreshStatus()} disabled={library.statusLoading}>{t('refreshSoundStatus')}</Button>
            </>
          ) : (
            <><span>{t('soundChooseGame')}</span><Button size="sm" variant="secondary" className="ml-auto" onClick={onChooseGame}>{t('chooseGame')}</Button></>
          )}
        </div>

        {activePackage && (
          <div className="mb-4 flex flex-wrap items-center gap-3 border border-[#586b41] bg-[#202a1d] px-3 py-3 text-sm text-[#c4d79d]">
            <span className="min-w-0 flex-1"><strong className="font-medium">{t('soundCurrentPackage')}:</strong> {activePackage.title || activePackage.archiveName}</span>
            <span className="text-xs">{t('soundInstalledBanks', { count: library.status?.installedBanks ?? 0 })}</span>
            <Button size="sm" variant="danger" disabled={!gameReady || busy} onClick={() => setConfirmRestore(true)}>{t('soundRestore')}</Button>
          </div>
        )}
        {library.status?.backupAvailable && !activePackage && (
          <div className="mb-4 flex flex-wrap items-center gap-3 border border-[#41483d] bg-[#1d231d] px-3 py-3 text-sm text-[#c0c5bb]">
            <span className="min-w-0 flex-1">{t('soundBackupAvailable')}</span>
            <Button size="sm" variant="secondary" disabled={!gameReady || busy} onClick={() => setConfirmRestore(true)}>{t('soundRestore')}</Button>
          </div>
        )}

        {library.error && <p className="mb-4 text-sm text-amber-200" role="alert">{library.error}</p>}
        {library.loading ? <div className="py-7 text-center text-sm text-[#9fa89b]">{t('loading')}</div> : library.packages.length === 0 ? (
          <div className="grid min-h-24 place-items-center border border-dashed border-[#3a4238] text-sm text-[#9fa89b]">{t('soundNoPackages')}</div>
        ) : (
          <div className="grid grid-cols-3 gap-3 max-[1100px]:grid-cols-2 max-[720px]:grid-cols-1">
            {library.packages.map(packageInfo => (
              <SoundPackageCard key={packageInfo.id} packageInfo={packageInfo} status={library.status} gameReady={gameReady} busy={busy} onInstall={setPendingInstall} />
            ))}
          </div>
        )}
      </section>

      {postDetail.selected && (
        <SoundPostDetailDialog
          item={postDetail.selected}
          detail={postDetail.detail}
          loading={postDetail.detailLoading}
          error={postDetail.detailError}
          imageQuality={imageQuality}
          canDownload={isTauriRuntime}
          downloadedLangGroups={downloadedLangGroups}
          downloadBusy={library.downloadingId != null}
          downloadingId={library.downloadingId}
          progress={library.downloadProgress
            ? { ...library.downloadProgress, paused: library.paused }
            : null}
          downloadError={library.error}
          onDownload={item => void library.download(item)}
          onTogglePause={() => void library.togglePause()}
          onCancel={() => void library.cancelDownload()}
          onSearchHashtag={searchHashtag}
          onClose={postDetail.closePost}
        />
      )}

      {(pendingInstall || confirmRestore) && (
        <SoundActionConfirmDialog
          title={t(pendingInstall ? 'confirmSoundInstall' : 'confirmSoundRestore')}
          description={pendingInstall
            ? t('confirmSoundInstallDescription', { title: pendingInstall.title || pendingInstall.archiveName })
            : t('confirmSoundRestoreDescription')}
          actionLabel={t(pendingInstall ? 'soundInstallPackage' : 'soundRestore')}
          busy={busy}
          onConfirm={() => void confirmSoundAction()}
          onClose={() => { setPendingInstall(null); setConfirmRestore(false) }}
        />
      )}
    </div>
  )
}
