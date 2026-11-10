import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Activity, ChevronDown, RefreshCw, Search } from 'lucide-react'
import { GameSetupModal } from './components/GameSetupModal'
import { ConfirmUninstallModal } from './components/ConfirmUninstallModal'
import { ConfirmRemoveFavoriteModal } from './components/ConfirmRemoveFavoriteModal'
import { LegalNoticeDialog } from './components/LegalNoticeDialog'
import { ImageQualitySetupDialog } from './components/ImageQualitySetupDialog'
import { NavigationSidebar, type AppSection } from './components/NavigationSidebar'
import { SectionHeader } from './components/HeroBanner'
import { PostCard } from './components/PostCard'
import { PostDetailDialog } from './components/PostDetailDialog'
import { PostCardSkeleton } from './components/PostCardSkeleton'
import { InstalledSkinCard } from './components/InstalledSkinCard'
import { DownloadsLibraryControls, DownloadsLibrarySummary } from './components/DownloadsLibraryControls'
import { PaginatedGrid } from './components/PaginatedGrid'
import { MasonryPostGrid } from './components/MasonryPostGrid'
import { SoundManagerPage } from './components/SoundManagerPage'
import { PeriodFilter } from './components/PeriodFilter'
import { EmptyLibraryState } from './components/EmptyLibraryState'
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
import { filterAndSortInstalledSkins, type DownloadOriginFilter, type DownloadSortOrder } from './lib/downloadLibrary'
import { isTauriRuntime } from './lib/gameInstall'
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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const { searches, setSearch } = useSectionSearch()
  const query = searches[active] ?? ''
  const searchInputRef = useRef<HTMLInputElement>(null)
  const mainScrollRef = useRef<HTMLElement>(null)
  const [sort, setSort] = useState<'recent' | 'popular'>('recent')
  const [downloadsOrigin, setDownloadsOrigin] = useState<DownloadOriginFilter>('all')
  const [downloadsSort, setDownloadsSort] = useState<DownloadSortOrder>('recent')
  const [favoriteToRemove, setFavoriteToRemove] = useState<WtLiveItem | null>(null)
  const feedSort: WtLiveFeedSort = active === 'camouflages' && sort === 'popular' ? 'rating' : 'created'
  const feedEnabled = active !== 'favorites' && active !== 'downloads' && active !== 'sounds' && active !== 'settings'
  const feed = useCamouflageFeed({ enabled: feedEnabled && !legalNotice.isRequired && !imageQuality.isSetupRequired, query, sort: feedSort })
  const skinInstaller = useSkinInstaller({ gamePath: gameSetup.gameInstall?.path, t, onInstalled: library.recordInstallation })
  const { selected, detail, detailLoading, detailError, openPost, closePost } = usePostDetail({
    onResetInstallState: skinInstaller.resetInstallState,
  })
  const closeMobileMenu = useCallback(() => setMobileMenuOpen(false), [])

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

  const catalog = active === 'favorites' ? library.favorites : feed.items
  const visible = useMemo(() => {
    if (active !== 'favorites') return catalog
    const filtered = catalog.filter(item => `${item.title} ${item.author} ${item.fileName ?? ''} ${item.description}`.toLowerCase().includes(query.toLowerCase()))
    return sort === 'popular' ? [...filtered].sort((a, b) => b.likes - a.likes) : [...filtered].sort((a, b) => b.createdAt - a.createdAt)
  }, [active, catalog, query, sort])

  const visibleInstallations = useMemo(
    () => filterAndSortInstalledSkins(library.installedSkins, query, downloadsOrigin, downloadsSort),
    [library.installedSkins, query, downloadsOrigin, downloadsSort],
  )
  const installedSkinsTotalBytes = useMemo(
    () => library.installedSkins.reduce((total, entry) => total + entry.sizeBytes, 0),
    [library.installedSkins],
  )

  const installedIds = useMemo(
    () => new Set(library.installedSkins.flatMap(s => (s.item?.id != null ? [s.item.id] : []))),
    [library.installedSkins],
  )

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

  function renderActiveSection() {
    const emptyMessage = <div className="grid min-h-40 place-items-center text-center text-sm text-[#b1b7ab]">{t('notFound')}</div>
    if (active === 'downloads') {
      if (visibleInstallations.length === 0) return library.installedSkins.length > 0 ? <div className="grid min-h-40 place-items-center text-center text-sm text-[#b1b7ab]">{t('noMatchingDownloads')}</div> : <EmptyLibraryState kind="downloads" onExplore={() => setActive('camouflages')} />
      return <PaginatedGrid items={visibleInstallations} resetKey={`downloads-${query}-${downloadsOrigin}-${downloadsSort}`} getKey={entry => entry.path} gridClassName="grid grid-cols-2 gap-3 min-[1600px]:grid-cols-3 min-[2300px]:grid-cols-4 max-[720px]:grid-cols-1" renderItem={entry => <InstalledSkinCard entry={entry} onOpen={openPost} onUninstall={library.requestUninstall} />} />
    }
    if (active === 'favorites') {
      if (visible.length === 0) return query ? emptyMessage : <EmptyLibraryState kind="favorites" onExplore={() => setActive('camouflages')} />
      return (
        <PaginatedGrid
          items={visible}
          resetKey={`favorites-${query}`}
          renderGrid={visibleItems => (
            <MasonryPostGrid
              items={visibleItems}
              renderItem={item => (
                <PostCard
                  item={item}
                  isSaved
                  isInstalled={installedIds.has(item.id)}
                  onOpen={openPost}
                  onToggleSaved={() => setFavoriteToRemove(item)}
                />
              )}
            />
          )}
        />
      )
    }
    if (feed.error) return <div className="grid min-h-40 place-items-center text-center"><div><p className="text-sm text-[#c2c8bb]">{feed.error}</p><Button variant="primary" onClick={feed.retry}>{t('retry')}</Button></div></div>
    if (feed.loading) return <PostCardSkeleton label={t('loading')} />
    if (visible.length === 0) return emptyMessage

    const isItemSaved = (item: WtLiveItem) => library.favorites.some(saved => saved.id === item.id)
    return (
      <>
        <MasonryPostGrid
          items={visible}
          renderItem={item => (
            <PostCard
              item={item}
              isSaved={isItemSaved(item)}
              isInstalled={installedIds.has(item.id)}
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

  const isLocalLibrary = active === 'downloads' || active === 'favorites'
  const titleFirstLine = isLocalLibrary ? '' : t('recentTitlePrefix')
  const titleLastWord = active === 'downloads' ? t('downloads') : active === 'favorites' ? t('favorites') : t('recentTitleHighlight')
  const selectedInstalledSkin = selected ? library.installedSkins.find(s => s.item?.id === selected.id) : null

  return <div className={`${isTauriRuntime ? 'h-dvh overflow-hidden' : 'min-h-screen'} bg-wt-bg font-sans text-[#e3e4dc]`} onContextMenu={event => event.preventDefault()}>
    {isTauriRuntime && <WindowTitleBar />}
    <NavigationSidebar
      active={active} hasCustomTitleBar={isTauriRuntime} mobileOpen={mobileMenuOpen}
      installedCount={library.installedSkins.length}
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
        /> : active === 'sounds' ? <SoundManagerPage gamePath={gameSetup.gameInstall?.path} imageQuality={imageQuality.quality} onChooseGame={gameSetup.openSetup} /> : active === 'home' ? <HomeDashboard
          items={feed.items} favorites={library.favorites} installedSkins={library.installedSkins}
          favoritesCount={library.favorites.length} installedCount={library.installedSkins.length}
          gameConfigured={Boolean(gameSetup.gameInstall)} loading={feed.loading} error={feed.error} online={feed.online}
          isSaved={item => library.favorites.some(saved => saved.id === item.id)}
          onNavigate={section => { setActive(section); if (section === 'camouflages') feed.loadPage(0) }}
          onOpenGameSetup={gameSetup.openSetup} onRetry={feed.retry}
          onOpen={openPost} onToggleSaved={library.toggleFavorite} onUninstall={library.requestUninstall}
        /> : <div className="flex w-full flex-1 flex-col px-8 pb-5 pt-8 max-[1100px]:px-6 max-[720px]:px-4 max-[720px]:pt-6">
          <SectionHeader
            variant={active === 'downloads' ? 'downloads' : active === 'favorites' ? 'favorites' : 'radar'}
            size={isLocalLibrary ? 'compact' : 'catalog'}
            eyebrow={isLocalLibrary ? t('libraryLocal') : t('communityContent')}
            titlePrefix={titleFirstLine}
            titleHighlight={titleLastWord}
            subtitle={!isLocalLibrary ? t('recentSubtitle') : undefined}
          />

          <section className={`my-[22px] flex flex-wrap items-center gap-2.5 max-[720px]:mt-[17px] ${active === 'downloads' ? 'mb-3 max-[720px]:mb-3' : 'mb-[31px] max-[720px]:mb-6'}`}>
            <label className="flex h-11 min-w-[240px] max-w-[490px] flex-1 items-center gap-2.5 border border-[#343b32] bg-wt-panel px-3 text-[#a0aa9b] focus-within:border-[#717d5b]"><Search size={17} /><input ref={searchInputRef} className="min-w-0 flex-1 bg-transparent text-sm text-[#e2e5db] outline-none placeholder:text-[#929a8e]" value={query} onChange={event => { setSearch(active, event.target.value); feed.setSearchInput(event.target.value) }} placeholder={t('searchPlaceholder')} /><kbd className="border border-[#41483d] px-1.5 py-0.5 text-[10px] text-[#929a8e] max-[720px]:hidden">{isApple ? '⌘ K' : 'Ctrl K'}</kbd></label>
            {(active === 'camouflages' || active === 'favorites') && (
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
            {active === 'downloads' && <DownloadsLibraryControls origin={downloadsOrigin} sort={downloadsSort} onOriginChange={setDownloadsOrigin} onSortChange={setDownloadsSort} />}
          </section>

          {!isLocalLibrary && <div className="flex min-h-6 items-center"><p className="mb-0 flex items-center gap-2 text-xs text-[#a1a99b]">{feed.loading ? t('loading') : <>{t(feed.online ? 'updatedFrom' : 'offlineSource')} <span className={`inline-block size-1.5 rounded-full ${feed.online ? 'bg-[#9cae70]' : 'bg-[#788078]'}`} /></>}</p></div>}
          {active === 'downloads' && <>
            <div className="mb-5 mt-1 flex flex-wrap items-center justify-between gap-3">
              <DownloadsLibrarySummary totalCount={library.installedSkins.length} totalSizeBytes={installedSkinsTotalBytes} />
              {gameSetup.gameInstall && <Button variant="secondary" size="sm" className="min-h-10" onClick={() => void library.rescanSkins()} disabled={library.scanning}>
                <RefreshCw size={13} className={library.scanning ? 'animate-spin motion-reduce:animate-none' : ''} aria-hidden="true" />
                <span>{t(library.scanning ? 'scanningSkins' : 'rescanSkins')}</span>
              </Button>}
            </div>
          </>}
          {active !== 'downloads' && <div className="mb-3.5 mt-5 flex items-center gap-2"><span className="ml-auto text-[11px] text-[#929a8e]">{t('posts', { count: visible.length })}</span></div>}

          {renderActiveSection()}
        </div>}
      </div>
      <BackToTopButton
        enabled={active === 'camouflages' || active === 'downloads'}
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
    {selected && (
      <PostDetailDialog
        item={selected} detail={detail} loading={detailLoading} error={detailError} imageQuality={imageQuality.quality}
        canInstall={isTauriRuntime} installer={skinInstaller}
        installedEntry={selectedInstalledSkin}
        onInstall={() => void handleInstallSkin()}
        onReinstall={entry => { if (selected) void skinInstaller.install(selected, entry.folderName) }}
        onUninstall={entry => { closePost(); library.requestUninstall(entry); }}
        onChooseGame={gameSetup.openSetup}
        onSearchHashtag={handleSearchHashtag} onClose={closePost}
      />
    )}
  </div>
}
