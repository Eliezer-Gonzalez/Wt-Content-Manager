import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Activity, ChevronDown, Search } from 'lucide-react'
import { GameSetupModal } from './components/GameSetupModal'
import { ConfirmUninstallModal } from './components/ConfirmUninstallModal'
import { ConfirmRemoveFavoriteModal } from './components/ConfirmRemoveFavoriteModal'
import { DownloadCancelConfirmDialog } from './components/DownloadCancelConfirmDialog'
import { LegalNoticeDialog } from './components/LegalNoticeDialog'
import { ImageQualitySetupDialog } from './components/ImageQualitySetupDialog'
import { NavigationSidebar, type AppSection } from './components/NavigationSidebar'
import { SectionHeader } from './components/HeroBanner'
import { PostCard } from './components/PostCard'
import { PostDetailDialog } from './components/PostDetailDialog'
import { PostCardSkeleton } from './components/PostCardSkeleton'
import { DownloadsPage } from './components/DownloadsPage'
import { PaginatedGrid } from './components/PaginatedGrid'
import { MasonryPostGrid } from './components/MasonryPostGrid'
import { SoundManagerPage } from './components/SoundManagerPage'
import { SoundPostDetailDialog } from './components/SoundPostDetailDialog'
import { FavoritesPage, type FavoriteCategory, type FavoriteSort } from './components/FavoritesPage'
import { PeriodFilter } from './components/PeriodFilter'
import { HomeDashboard } from './components/HomeDashboard'
import { SettingsPage } from './components/SettingsPage'
import { WindowTitleBar } from './components/WindowTitleBar'
import { BackToTopButton } from './components/BackToTopButton'
import { Button } from './components/ui/Button'
import { APP_VERSION } from './lib/appInfo'
import { useGameInstallation } from './hooks/useGameInstallation'
import { useLocalLibrary } from './hooks/useLocalLibrary'
import { useSkinInstaller } from './hooks/useSkinInstaller'
import { useSectionSearch } from './hooks/useSectionSearch'
import { useAutoLoadMore } from './hooks/useAutoLoadMore'
import { useCamouflageFeed } from './hooks/useCamouflageFeed'
import { usePostDetail } from './hooks/usePostDetail'
import { useDiagnosticsSettings } from './hooks/useDiagnosticsSettings'
import { useLegalNotice } from './hooks/useLegalNotice'
import { useImageQualityPreference } from './hooks/useImageQualityPreference'
import { useSoundLibrary } from './hooks/useSoundLibrary'
import { useSoundPackageUpdates } from './hooks/useSoundPackageUpdates'
import type { DownloadOriginFilter, DownloadSortOrder, SoundDownloadStatusFilter } from './lib/downloadLibrary'
import { isTauriRuntime } from './lib/gameInstall'
import { sameFavorite } from './lib/localLibrary'
import { useI18n, asTranslationKey } from './i18n/I18nProvider'
import type { WtLiveFeedSort, WtLiveItem } from './lib/wtLive'

const isApple = typeof navigator !== 'undefined' && /(Mac|iPhone|iPod|iPad)/i.test(navigator.userAgent || navigator.platform || '')

export default function App() {
  const { t, locale, languages, setLocale } = useI18n()
  const gameSetup = useGameInstallation()
  const diagnostics = useDiagnosticsSettings()
  const legalNotice = useLegalNotice()
  const imageQuality = useImageQualityPreference()
  const library = useLocalLibrary(gameSetup.gameInstall?.path, t)
  const [active, setActive] = useState<AppSection>('camouflages')
  const [downloadsCategory, setDownloadsCategory] = useState<'camouflages' | 'sounds'>('camouflages')
  const [favoritesCategory, setFavoritesCategory] = useState<FavoriteCategory>('camouflages')
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const { searches, setSearch } = useSectionSearch()
  const query = active === 'favorites'
    ? searches[favoritesCategory === 'sounds' ? 'favorites-sounds' : 'favorites'] ?? ''
    : searches[active] ?? ''
  const camouflageCatalogQuery = active === 'home' ? '' : searches.camouflages ?? ''
  const searchInputRef = useRef<HTMLInputElement>(null)
  const mainScrollRef = useRef<HTMLElement>(null)
  const [sort, setSort] = useState<'recent' | 'popular'>('recent')
  const [downloadsOrigin, setDownloadsOrigin] = useState<DownloadOriginFilter>('all')
  const [downloadsSort, setDownloadsSort] = useState<DownloadSortOrder>('recent')
  const [soundDownloadsFilter, setSoundDownloadsFilter] = useState<SoundDownloadStatusFilter>('all')
  const [soundDownloadsSort, setSoundDownloadsSort] = useState<DownloadSortOrder>('recent')
  const [favoriteCamouflageSort, setFavoriteCamouflageSort] = useState<FavoriteSort>('recent')
  const [favoriteSoundSort, setFavoriteSoundSort] = useState<FavoriteSort>('recent')
  const [favoriteToRemove, setFavoriteToRemove] = useState<WtLiveItem | null>(null)
  const feedSort: WtLiveFeedSort = active === 'camouflages' && sort === 'popular' ? 'rating' : 'created'
  const feedEnabled = active !== 'favorites' && active !== 'downloads' && active !== 'sounds' && active !== 'settings'
  const feed = useCamouflageFeed({ enabled: feedEnabled && !legalNotice.isRequired && !imageQuality.isSetupRequired, query: camouflageCatalogQuery, sort: feedSort })
  const soundLibrary = useSoundLibrary(
    gameSetup.gameInstall?.path,
    active === 'sounds' || (active === 'downloads' && downloadsCategory === 'sounds') ||
      (active === 'favorites' && favoritesCategory === 'sounds') || active === 'home',
  )
  const soundUpdates = useSoundPackageUpdates(
    soundLibrary.packages,
    active === 'downloads' && downloadsCategory === 'sounds' && !soundLibrary.loading,
  )
  const skinInstaller = useSkinInstaller({ gamePath: gameSetup.gameInstall?.path, t, onInstalled: library.recordInstallation })
  const pendingCancellationRef = useRef<'skin' | 'sound' | null>(null)
  const [pendingCancellation, setPendingCancellation] = useState<'skin' | 'sound' | null>(null)
  const { selected, detail, detailLoading, detailError, openPost, closePost } = usePostDetail({
    onResetInstallState: skinInstaller.resetInstallState,
  })
  const closeMobileMenu = useCallback(() => setMobileMenuOpen(false), [])

  const requestSkinCancellation = useCallback(async () => {
    if (pendingCancellationRef.current) return
    pendingCancellationRef.current = 'skin'
    if (await skinInstaller.prepareCancel()) setPendingCancellation('skin')
    else pendingCancellationRef.current = null
  }, [skinInstaller.prepareCancel])
  const requestSoundCancellation = useCallback(async () => {
    if (pendingCancellationRef.current) return
    pendingCancellationRef.current = 'sound'
    if (await soundLibrary.prepareCancelDownload()) setPendingCancellation('sound')
    else pendingCancellationRef.current = null
  }, [soundLibrary.prepareCancelDownload])
  const continuePendingCancellation = useCallback(() => {
    const contentType = pendingCancellationRef.current
    pendingCancellationRef.current = null
    setPendingCancellation(null)
    if (contentType === 'skin') void skinInstaller.continueAfterCancelPrompt()
    if (contentType === 'sound') void soundLibrary.continueAfterCancelPrompt()
  }, [skinInstaller.continueAfterCancelPrompt, soundLibrary.continueAfterCancelPrompt])
  const confirmPendingCancellation = useCallback(() => {
    const contentType = pendingCancellationRef.current
    pendingCancellationRef.current = null
    setPendingCancellation(null)
    if (contentType === 'skin') void skinInstaller.cancel()
    if (contentType === 'sound') void soundLibrary.cancelDownload()
  }, [skinInstaller.cancel, soundLibrary.cancelDownload])
  const dismissPendingCancellation = useCallback(() => {
    const contentType = pendingCancellationRef.current
    pendingCancellationRef.current = null
    setPendingCancellation(null)
    if (contentType === 'skin') void skinInstaller.dismissCancelPrompt()
    if (contentType === 'sound') void soundLibrary.dismissCancelPrompt()
  }, [skinInstaller.dismissCancelPrompt, soundLibrary.dismissCancelPrompt])
  const skinInstallerForUi = { ...skinInstaller, cancel: requestSkinCancellation }
  const soundLibraryForUi = { ...soundLibrary, cancelDownload: requestSoundCancellation }

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        searchInputRef.current?.focus()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const visible = feed.items

  const installedIds = useMemo(
    () => new Set(library.installedSkins.flatMap(s => (s.item?.id != null ? [s.item.id] : []))),
    [library.installedSkins],
  )
  const downloadedSoundLangGroups = useMemo(
    () => new Set(soundLibrary.packages.map(packageInfo => packageInfo.langGroup)),
    [soundLibrary.packages],
  )
  const currentSoundLangGroups = useMemo(() => new Set(soundLibrary.packages
    .filter(packageInfo => soundUpdates.results[packageInfo.id]?.status !== 'possible')
    .map(packageInfo => packageInfo.langGroup)), [soundLibrary.packages, soundUpdates.results])
  const isFavoriteSaved = (item: WtLiveItem, contentType: 'camouflage' | 'sound') =>
    library.favorites.some(saved => sameFavorite(saved, { ...item, contentType }))

  const feedLoadMoreRef = useAutoLoadMore({
    enabled: active === 'camouflages' && feed.hasNext && !feed.loading && !feed.loadingMore && !feed.loadMoreError && visible.length > 0 && visible.length % 150 !== 0,
    onLoadMore: feed.loadMore,
  })

  async function handleInstallSkin() {
    if (!selected) return
    if (!gameSetup.gameInstall) { gameSetup.openSetup(); return }
    void skinInstaller.install(selected)
  }

  function handleSearchHashtag(tag: string) {
    const nextQuery = `#${tag}`
    setSearch('camouflages', nextQuery)
    setActive('camouflages')
    feed.applySearchTag(nextQuery)
    closePost()
  }

  function handleSoundSearchHashtag(tag: string) {
    setSearch('sounds', `#${tag}`)
    setActive('sounds')
    closePost()
  }

  function renderActiveSection() {
    const emptyMessage = <div className="grid min-h-40 place-items-center text-center text-sm text-[#b1b7ab]">{t('notFound')}</div>
    if (feed.error) return <div className="grid min-h-40 place-items-center text-center"><div><p className="text-sm text-[#c2c8bb]">{feed.error}</p><Button variant="primary" onClick={feed.retry}>{t('retry')}</Button></div></div>
    if (feed.loading) return <PostCardSkeleton label={t('loading')} />
    if (visible.length === 0) return emptyMessage

    return (
      <>
        <MasonryPostGrid
          items={visible}
          renderItem={item => (
            <PostCard
              item={item}
              isSaved={isFavoriteSaved(item, 'camouflage')}
              isInstalled={installedIds.has(item.id)}
              skinProgress={skinInstaller.activeLangGroup === item.langGroup && skinInstaller.installing
                ? { ...(skinInstaller.progress ?? { phase: 'preparing' as const, downloadedBytes: 0, totalBytes: null, paused: false }), paused: skinInstaller.paused }
                : null}
              cancellingDownload={skinInstaller.cancelling}
              onToggleDownloadPause={() => void skinInstaller.togglePause()}
              onCancelDownload={requestSkinCancellation}
              onOpen={openPost}
              onToggleSaved={library.toggleFavorite}
            />
          )}
        />
        {(feed.loadMoreError || feed.hasNext || feed.loadingMore) && (
          <div className="mt-4 flex min-h-6 items-center justify-center">
            {feed.loadMoreError && <p className="mb-0 text-center text-sm text-amber-200" role="alert">{feed.loadMoreError}</p>}
          </div>
        )}
        {(feed.hasNext || feed.loadingMore) && (
          <div ref={feedLoadMoreRef} className="mt-5 flex justify-center">
            <Button variant="quiet" disabled={feed.loadingMore} onClick={() => (feed.loadMoreError ? feed.retry() : feed.loadMore())}>
              {feed.loadingMore ? t('loadingMore') : t(feed.loadMoreError ? 'retry' : 'loadMore')}
            </Button>
          </div>
        )}
      </>
    )
  }

  const selectedInstalledSkin = selected ? library.installedSkins.find(s => s.item?.id === selected.id) : null

  return <div className={`${isTauriRuntime ? 'h-dvh overflow-hidden' : 'min-h-screen'} bg-wt-bg font-sans text-[#e3e4dc]`} onContextMenu={event => event.preventDefault()}>
    {isTauriRuntime && <WindowTitleBar />}
    <NavigationSidebar
      active={active} hasCustomTitleBar={isTauriRuntime} mobileOpen={mobileMenuOpen}
      installedCount={library.installedSkins.length + soundLibrary.packages.length}
      online={feed.online}
      onNavigate={key => { setActive(key); if (key === 'camouflages' || key === 'home') feed.loadPage(0) }}
      onToggleMobile={() => setMobileMenuOpen(open => !open)} onCloseMobile={closeMobileMenu}
    />

    <main ref={mainScrollRef} className={`ml-[246px] flex flex-col max-[1100px]:ml-[210px] max-[720px]:ml-0 ${isTauriRuntime ? 'h-[calc(100dvh-36px)] min-h-0 overflow-y-auto [overflow-anchor:none]' : 'min-h-screen'}`}>
      <header className="flex h-[59px] shrink-0 items-center justify-between border-b border-[#2c332c] px-[42px] max-[1100px]:px-[26px] max-[720px]:h-12 max-[720px]:px-[17px]">
        <div className="text-[10px] tracking-[.13em] text-[#a0a99c]">{t('sourceName')} <span className="px-2 text-[#717b6e]">/</span> <b className="font-medium text-[#d3d7ca]">{t(asTranslationKey(active)).toUpperCase()}</b></div>
        <div className="flex items-center gap-3 min-[721px]:gap-5">
          <span className="flex items-center gap-1.5 text-xs text-[#a1a99b] max-[520px]:hidden"><Activity size={14} />{t('catalog')}</span>
          <label className="flex items-center gap-1.5 text-xs text-[#a1a99b]"><span className="sr-only min-[521px]:not-sr-only">{t('language')}</span><select className="border border-[#343b32] bg-wt-panel px-2 py-1.5 text-xs text-[#d3d7ca] focus-visible:outline-2 focus-visible:outline-olive" value={locale} onChange={event => setLocale(event.target.value)} aria-label={t('language')}>{languages.map(language => <option key={language.code} value={language.code}>{language.name}</option>)}</select></label>
        </div>
      </header>

      <div className="flex flex-1 flex-col">
        {active === 'settings' ? <SettingsPage
          gameInstall={gameSetup.gameInstall}
          gameLoading={gameSetup.loading}
          diagnostics={diagnostics} imageQuality={imageQuality.quality} onChangeImageQuality={imageQuality.setQuality}
          onOpenGameSetup={gameSetup.openSetup}
          onRescanGame={() => void gameSetup.scan()}
          onViewLegalNotice={legalNotice.openNotice}
        /> : active === 'sounds' ? <SoundManagerPage
          imageQuality={imageQuality.quality}
          soundLibrary={soundLibraryForUi}
          cancelDialogOpen={pendingCancellation === 'sound'}
          downloadableLangGroups={currentSoundLangGroups}
          searchInputRef={searchInputRef}
          query={searches.sounds ?? ''}
          onQueryChange={value => setSearch('sounds', value)}
          isSaved={item => isFavoriteSaved(item, 'sound')}
          onToggleSaved={library.toggleFavorite}
        /> : active === 'downloads' ? <DownloadsPage
          category={downloadsCategory}
          onCategoryChange={setDownloadsCategory}
          searchInputRef={searchInputRef}
          onExploreCamouflages={() => { setActive('camouflages'); feed.loadPage(0) }}
          camouflages={{
            entries: library.installedSkins,
            query: searches.downloads ?? '',
            onQueryChange: value => setSearch('downloads', value),
            origin: downloadsOrigin,
            onOriginChange: setDownloadsOrigin,
            sort: downloadsSort,
            onSortChange: setDownloadsSort,
            gamePath: gameSetup.gameInstall?.path,
            scanning: library.scanning,
            onRescan: () => void library.rescanSkins(),
            onOpenPost: openPost,
            onUninstall: library.requestUninstall,
          }}
          sounds={{
            library: soundLibraryForUi,
            query: searches['downloads-sounds'] ?? '',
            onQueryChange: value => setSearch('downloads-sounds', value),
            statusFilter: soundDownloadsFilter,
            onStatusFilterChange: setSoundDownloadsFilter,
            sort: soundDownloadsSort,
            onSortChange: setSoundDownloadsSort,
            gamePath: gameSetup.gameInstall?.path,
            onChooseGame: gameSetup.openSetup,
            onExploreSounds: () => setActive('sounds'),
            onOpenPost: openPost,
            updates: soundUpdates,
          }}
        /> : active === 'favorites' ? <FavoritesPage
          favorites={library.favorites}
          category={favoritesCategory}
          onCategoryChange={setFavoritesCategory}
          camouflageQuery={searches.favorites ?? ''}
          onCamouflageQueryChange={value => setSearch('favorites', value)}
          soundQuery={searches['favorites-sounds'] ?? ''}
          onSoundQueryChange={value => setSearch('favorites-sounds', value)}
          camouflageSort={favoriteCamouflageSort}
          onCamouflageSortChange={setFavoriteCamouflageSort}
          soundSort={favoriteSoundSort}
          onSoundSortChange={setFavoriteSoundSort}
          searchInputRef={searchInputRef}
          onOpen={openPost}
          onRemove={setFavoriteToRemove}
          isInstalled={item => item.contentType === 'sound'
            ? soundLibrary.status?.activePackageId != null && soundLibrary.packages.some(packageInfo => packageInfo.langGroup === item.langGroup && packageInfo.id === soundLibrary.status?.activePackageId)
            : installedIds.has(item.id)}
          isDownloaded={item => item.contentType === 'sound' && downloadedSoundLangGroups.has(item.langGroup)}
          onExplore={category => { setActive(category); if (category === 'camouflages') feed.loadPage(0) }}
        /> : active === 'home' ? <HomeDashboard
          items={feed.items} favorites={library.favorites} installedSkins={library.installedSkins}
          favoritesCount={library.favorites.length} installedCount={library.installedSkins.length + soundLibrary.packages.length}
          gameConfigured={Boolean(gameSetup.gameInstall)} loading={feed.loading} error={feed.error} online={feed.online}
          isSaved={item => isFavoriteSaved(item, item.contentType ?? 'camouflage')}
          isDownloaded={item => item.contentType === 'sound' && downloadedSoundLangGroups.has(item.langGroup)}
          isInstalled={item => item.contentType === 'sound'
            ? soundLibrary.status?.activePackageId != null && soundLibrary.packages.some(packageInfo => packageInfo.langGroup === item.langGroup && packageInfo.id === soundLibrary.status?.activePackageId)
            : installedIds.has(item.id)}
          onNavigate={section => { setActive(section); if (section === 'camouflages') feed.loadPage(0) }}
          onOpenGameSetup={gameSetup.openSetup} onRetry={feed.retry}
          onOpen={openPost} onToggleSaved={library.toggleFavorite} onUninstall={library.requestUninstall}
        /> : <div className="flex w-full flex-1 flex-col px-8 pb-5 pt-8 max-[1100px]:px-6 max-[720px]:px-4 max-[720px]:pt-6">
          <SectionHeader
            variant="radar"
            size="catalog"
            eyebrow={t('communityContent')}
            titlePrefix={t('recentTitlePrefix')}
            titleHighlight={t('recentTitleHighlight')}
            subtitle={t('recentSubtitle')}
          />

          <section className="my-[22px] mb-[31px] flex flex-wrap items-center gap-2.5 max-[720px]:mb-6 max-[720px]:mt-[17px]">
            <label className="flex h-11 min-w-[240px] max-w-[490px] flex-1 items-center gap-2.5 border border-[#343b32] bg-wt-panel px-3 text-[#a0aa9b] focus-within:border-[#717d5b]"><Search size={17} /><input ref={searchInputRef} className="min-w-0 flex-1 bg-transparent text-sm text-[#e2e5db] outline-none placeholder:text-[#929a8e]" value={query} onChange={event => { setSearch(active, event.target.value); if (active === 'camouflages') feed.setSearchInput(event.target.value) }} placeholder={t('searchPlaceholder')} /><kbd className="border border-[#41483d] px-1.5 py-0.5 text-[10px] text-[#929a8e] max-[720px]:hidden">{isApple ? '⌘ K' : 'Ctrl K'}</kbd></label>
            {active === 'camouflages' && (
              <div className="flex flex-wrap items-center gap-2.5">
                {active === 'camouflages' && <PeriodFilter value={feed.period} onChange={feed.changePeriod} />}
                <Button variant="quiet" className="min-h-11 px-3 text-xs" onClick={() => {
                  setSort(current => current === 'recent' ? 'popular' : 'recent')
                  if (active === 'camouflages') feed.loadPage(0)
                }}>
                  {t(sort)}<ChevronDown size={14} aria-hidden="true" />
                </Button>
              </div>
            )}
          </section>

          <div className="flex min-h-6 items-center"><p className="mb-0 flex items-center gap-2 text-xs text-[#a1a99b]">{feed.loading ? t('loading') : <>{t(feed.online ? 'updatedFrom' : 'offlineSource')} <span className={`inline-block size-1.5 rounded-full ${feed.online ? 'bg-[#9cae70]' : 'bg-[#788078]'}`} /></>}</p></div>
          <div className="mb-3.5 mt-5 flex items-center gap-2"><span className="ml-auto text-[11px] text-[#929a8e]">{t('posts', { count: visible.length })}</span></div>

          {renderActiveSection()}
        </div>}
      </div>
      <BackToTopButton
        key={active}
        enabled={active === 'camouflages' || active === 'downloads' || active === 'sounds'}
        markerRef={searchInputRef}
        scrollContainerRef={isTauriRuntime ? mainScrollRef : null}
      />
      <footer className="sticky bottom-0 z-20 mx-8 mt-auto flex shrink-0 flex-wrap justify-between gap-x-3 gap-y-1 border-t border-[#2d342d] bg-wt-bg px-1 py-3 text-[10px] tracking-[.06em] text-[#8d968a] max-[1100px]:mx-6 max-[720px]:mx-4"><span>{t('dataSource')}</span><span>By DestGM · {t('brandManager')} <b className="font-medium text-[#b2baa9]">{APP_VERSION}</b></span></footer>
    </main>

    <GameSetupModal
      open={gameSetup.isOpen && !legalNotice.isOpen && !imageQuality.isSetupRequired} loading={gameSetup.loading} error={gameSetup.error}
      installations={gameSetup.installations} selected={gameSetup.selected}
      onSelect={gameSetup.selectInstallation} onConfirm={gameSetup.confirmInstallation}
      onRescan={() => void gameSetup.scan()} onChooseManual={() => void gameSetup.chooseManual(t('gameSetupPickerTitle'))}
      onClose={gameSetup.closeSetup}
    />
    <ConfirmUninstallModal
      entry={library.uninstallTarget} busy={library.uninstalling} error={library.uninstallError}
      uninstalledFolder={library.uninstalledFolder} onDismissNotice={library.dismissUninstalledNotice}
      onConfirm={() => void library.confirmUninstall()} onClose={library.cancelUninstall}
    />
    <ConfirmRemoveFavoriteModal
      item={favoriteToRemove}
      onClose={() => setFavoriteToRemove(null)}
      onConfirm={() => {
        if (!favoriteToRemove) return
        library.toggleFavorite(favoriteToRemove)
        setFavoriteToRemove(null)
      }}
    />
    {pendingCancellation && (
      <DownloadCancelConfirmDialog
        onContinue={continuePendingCancellation}
        onConfirmCancel={confirmPendingCancellation}
        onDismiss={dismissPendingCancellation}
      />
    )}
    <LegalNoticeDialog
      open={legalNotice.isOpen}
      required={legalNotice.isRequired}
      keepWindowControlsVisible={isTauriRuntime}
      onAcknowledge={legalNotice.acknowledge}
      onClose={legalNotice.closeNotice}
    />
    <ImageQualitySetupDialog
      open={imageQuality.isSetupRequired && !legalNotice.isOpen} keepWindowControlsVisible={isTauriRuntime}
      initialQuality={imageQuality.quality} onConfirm={imageQuality.setQuality}
    />
    {selected?.contentType === 'sound' ? (
      <SoundPostDetailDialog
        item={selected}
        detail={detail}
        loading={detailLoading}
        error={detailError}
        imageQuality={imageQuality.quality}
        canDownload={isTauriRuntime}
        downloadedLangGroups={currentSoundLangGroups}
        downloadBusy={soundLibrary.downloadingId != null}
        downloadingId={soundLibrary.downloadingId}
        progress={soundLibrary.downloadProgress ? { ...soundLibrary.downloadProgress, paused: soundLibrary.paused } : null}
        downloadError={soundLibrary.error}
        activePackage={soundLibrary.packages.find(packageInfo => packageInfo.id === soundLibrary.status?.activePackageId && packageInfo.langGroup === selected.langGroup) ?? null}
        soundLibrary={soundLibraryForUi}
        canInstallPackage={isTauriRuntime}
        cancelDialogOpen={pendingCancellation === 'sound'}
        onDownload={item => void soundLibrary.download(item)}
        onTogglePause={() => void soundLibrary.togglePause()}
        onCancel={requestSoundCancellation}
        onSearchHashtag={handleSoundSearchHashtag}
        onClose={closePost}
      />
    ) : selected ? (
      <PostDetailDialog
        item={selected} detail={detail} loading={detailLoading} error={detailError} imageQuality={imageQuality.quality}
        canInstall={isTauriRuntime} installer={skinInstallerForUi}
        cancelDialogOpen={pendingCancellation === 'skin'}
        installedEntry={selectedInstalledSkin}
        onInstall={() => void handleInstallSkin()}
        onReinstall={entry => { if (selected) void skinInstaller.install(selected, entry.folderName) }}
        onUninstall={entry => { closePost(); library.requestUninstall(entry); }}
        onChooseGame={gameSetup.openSetup}
        onSearchHashtag={handleSearchHashtag} onClose={closePost}
      />
    ) : null}
  </div>
}
