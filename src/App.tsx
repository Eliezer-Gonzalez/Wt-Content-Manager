import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AppSystemDialogs } from './components/AppSystemDialogs'
import { AppHeader } from './components/AppHeader'
import { AppFooter } from './components/AppFooter'
import { NavigationSidebar, type AppSection } from './components/NavigationSidebar'
import { PostDetailsOverlay } from './components/PostDetailsOverlay'
import { DuplicateSkinDecisionDialog } from './components/DuplicateSkinDecisionDialog'
import { CamouflagesPage } from './components/CamouflagesPage'
import { DownloadsPage } from './components/DownloadsPage'
import { SoundManagerPage } from './components/SoundManagerPage'
import { FavoritesPage, type FavoriteCategory, type FavoriteSort } from './components/FavoritesPage'
import { HomeDashboard } from './components/HomeDashboard'
import { SettingsPage } from './components/SettingsPage'
import { WindowTitleBar } from './components/WindowTitleBar'
import { BackToTopButton } from './components/BackToTopButton'
import { DownloadCompletionNotifications } from './components/DownloadCompletionNotifications'
import { LocalLibraryStartupGate } from './components/LocalLibraryStartupGate'
import { useGameInstallation } from './hooks/useGameInstallation'
import { useLocalLibrary } from './hooks/useLocalLibrary'
import { useCamouflageManagement } from './hooks/useCamouflageManagement'
import { useSectionSearch } from './hooks/useSectionSearch'
import { useCamouflageFeed } from './hooks/useCamouflageFeed'
import { usePostDetail } from './hooks/usePostDetail'
import { useDiagnosticsSettings } from './hooks/useDiagnosticsSettings'
import { useLegalNotice } from './hooks/useLegalNotice'
import { useImageQualityPreference } from './hooks/useImageQualityPreference'
import { useSoundLibrary } from './hooks/useSoundLibrary'
import { useSoundPackageUpdates } from './hooks/useSoundPackageUpdates'
import { useDownloadCancellation } from './hooks/useDownloadCancellation'
import { useCompletionNotificationSettings } from './hooks/useCompletionNotificationSettings'
import type { DownloadOriginFilter, DownloadSortOrder, SoundDownloadStatusFilter } from './lib/downloadLibrary'
import { isTauriRuntime } from './lib/gameInstall'
import { sameFavorite } from './lib/localLibrary'
import { useI18n } from './i18n/I18nContext'
import type { WtLiveFeedSort, WtLiveItem } from './lib/wtLive'

export default function App() {
  const { t } = useI18n()
  const gameSetup = useGameInstallation()
  const diagnostics = useDiagnosticsSettings()
  const legalNotice = useLegalNotice()
  const imageQuality = useImageQualityPreference()
  const notificationSettings = useCompletionNotificationSettings()
  const library = useLocalLibrary(gameSetup.gameInstall?.path, t)
  const [active, setActive] = useState<AppSection>('camouflages')
  const [downloadsCategory, setDownloadsCategory] = useState<'camouflages' | 'sounds'>('camouflages')
  const [favoritesCategory, setFavoritesCategory] = useState<FavoriteCategory>('camouflages')
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const { searches, setSearch } = useSectionSearch()
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
  const { skinInstaller, installedIds } = useCamouflageManagement({ gamePath: gameSetup.gameInstall?.path, t, library })
  const cancellation = useDownloadCancellation({ skinInstaller, soundLibrary })
  const { selected, detail, detailLoading, detailError, openPost, closePost } = usePostDetail()
  const closeMobileMenu = useCallback(() => setMobileMenuOpen(false), [])

  const soundLibraryForUi = {
    ...soundLibrary,
    cancelDownload: cancellation.requestSoundCancellation,
    cancelUpdate: cancellation.requestSoundUpdateCancellation,
  }

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

  const downloadedSoundLangGroups = useMemo(
    () => new Set(soundLibrary.packages.map(packageInfo => packageInfo.langGroup)),
    [soundLibrary.packages],
  )
  const currentSoundLangGroups = useMemo(() => new Set(soundLibrary.packages
    .filter(packageInfo => {
      const result = soundUpdates.results[packageInfo.id]
      return result?.revision !== packageInfo.revision || result.status !== 'possible'
    })
    .map(packageInfo => packageInfo.langGroup)), [soundLibrary.packages, soundUpdates.results])
  const isFavoriteSaved = (item: WtLiveItem, contentType: 'camouflage' | 'sound') =>
    library.favorites.some(saved => sameFavorite(saved, { ...item, contentType }))
  const isSoundDownloaded = (item: WtLiveItem) => item.contentType === 'sound' && downloadedSoundLangGroups.has(item.langGroup)
  const isItemInstalled = (item: WtLiveItem) => item.contentType === 'sound'
    ? soundLibrary.status?.activePackageId != null && soundLibrary.packages.some(packageInfo => packageInfo.langGroup === item.langGroup && packageInfo.id === soundLibrary.status?.activePackageId)
    : installedIds.has(item.id)

  function openSection(section: AppSection) {
    setActive(section)
    if (section === 'camouflages') feed.loadPage(0)
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

  if (!library.ready) {
    return <div className={`${isTauriRuntime ? 'h-dvh overflow-hidden' : 'min-h-screen'} bg-wt-bg font-sans text-[#e3e4dc]`}>
      {isTauriRuntime && <WindowTitleBar />}
      <LocalLibraryStartupGate desktop={isTauriRuntime} error={library.loadError} onRetry={library.retryLibraryLoad} />
    </div>
  }

  return <div className={`${isTauriRuntime ? 'h-dvh overflow-hidden' : 'min-h-screen'} bg-wt-bg font-sans text-[#e3e4dc]`} onContextMenu={event => event.preventDefault()}>
    {isTauriRuntime && <WindowTitleBar />}
    <NavigationSidebar
      active={active} hasCustomTitleBar={isTauriRuntime} mobileOpen={mobileMenuOpen}
      installedCount={library.installedSkins.length + soundLibrary.packages.length} online={feed.online}
      onNavigate={key => { setActive(key); if (key === 'camouflages' || key === 'home') feed.loadPage(0) }}
      onToggleMobile={() => setMobileMenuOpen(open => !open)} onCloseMobile={closeMobileMenu}
    />

    <main ref={mainScrollRef} className={`ml-[246px] flex flex-col max-[1100px]:ml-[210px] max-[720px]:ml-0 ${isTauriRuntime ? 'h-[calc(100dvh-36px)] min-h-0 overflow-y-auto [overflow-anchor:none]' : 'min-h-screen'}`}>
      <AppHeader active={active} />
      {library.persistenceError && <div className="mx-6 mt-3 border border-amber-700/70 bg-amber-950/30 px-4 py-2 text-xs text-amber-100" role="alert">{t('localLibrarySaveFailed')}</div>}

      <div className="flex flex-1 flex-col">
        {active === 'settings' ? <SettingsPage
          gameInstall={gameSetup.gameInstall} gameLoading={gameSetup.loading}
          diagnostics={diagnostics} imageQuality={imageQuality.quality} onChangeImageQuality={imageQuality.setQuality}
          onOpenGameSetup={gameSetup.openSetup} onRescanGame={() => void gameSetup.scan()}
          onViewLegalNotice={legalNotice.openNotice} notificationSettings={notificationSettings} library={library}
        /> : active === 'sounds' ? <SoundManagerPage
          imageQuality={imageQuality.quality} soundLibrary={soundLibraryForUi}
          cancelDialogOpen={cancellation.pendingKind === 'sound'} downloadableLangGroups={currentSoundLangGroups}
          searchInputRef={searchInputRef} query={searches.sounds ?? ''} onQueryChange={value => setSearch('sounds', value)}
          isSaved={item => isFavoriteSaved(item, 'sound')} onToggleSaved={library.toggleFavorite}
        /> : active === 'downloads' ? <DownloadsPage
          category={downloadsCategory} onCategoryChange={setDownloadsCategory} searchInputRef={searchInputRef}
          onExploreCamouflages={() => openSection('camouflages')}
          camouflages={{
            entries: library.installedSkins,
            query: searches.downloads ?? '', onQueryChange: value => setSearch('downloads', value),
            origin: downloadsOrigin, onOriginChange: setDownloadsOrigin,
            sort: downloadsSort, onSortChange: setDownloadsSort,
            gamePath: gameSetup.gameInstall?.path, scanning: library.scanning,
            onRescan: () => void library.rescanSkins(), onOpenPost: openPost,
            onUninstall: library.requestUninstall,
            onUnlinkPublication: entry => library.unlinkExternalPublication(entry.path),
            isSaved: entry => {
              const item = entry.item ?? entry.externalPublication?.item
              return item ? isFavoriteSaved(item, 'camouflage') : false
            },
            onToggleSaved: library.toggleFavorite,
          }}
          sounds={{
            library: soundLibraryForUi,
            query: searches['downloads-sounds'] ?? '', onQueryChange: value => setSearch('downloads-sounds', value),
            statusFilter: soundDownloadsFilter, onStatusFilterChange: setSoundDownloadsFilter,
            sort: soundDownloadsSort, onSortChange: setSoundDownloadsSort,
            gamePath: gameSetup.gameInstall?.path, onChooseGame: gameSetup.openSetup,
            onExploreSounds: () => setActive('sounds'), onOpenPost: openPost, updates: soundUpdates,
          }}
        /> : active === 'favorites' ? <FavoritesPage
          favorites={library.favorites} category={favoritesCategory} onCategoryChange={setFavoritesCategory}
          camouflageQuery={searches.favorites ?? ''} onCamouflageQueryChange={value => setSearch('favorites', value)}
          soundQuery={searches['favorites-sounds'] ?? ''} onSoundQueryChange={value => setSearch('favorites-sounds', value)}
          camouflageSort={favoriteCamouflageSort} onCamouflageSortChange={setFavoriteCamouflageSort}
          soundSort={favoriteSoundSort} onSoundSortChange={setFavoriteSoundSort}
          searchInputRef={searchInputRef} onOpen={openPost} onRemove={setFavoriteToRemove}
          isInstalled={isItemInstalled} isDownloaded={isSoundDownloaded} onExplore={openSection}
        /> : active === 'home' ? <HomeDashboard
          items={feed.items} favorites={library.favorites} installedSkins={library.installedSkins}
          favoritesCount={library.favorites.length} installedCount={library.installedSkins.length + soundLibrary.packages.length}
          gameConfigured={Boolean(gameSetup.gameInstall)} loading={feed.loading} error={feed.error} online={feed.online}
          isSaved={item => isFavoriteSaved(item, item.contentType ?? 'camouflage')}
          isDownloaded={isSoundDownloaded} isInstalled={isItemInstalled} onNavigate={openSection}
          onSeeRecentCamouflages={() => {
            setSearch('camouflages', '')
            setSort('recent')
            feed.applySearchTag('')
            feed.changePeriod(7)
            feed.loadPage(0)
            setActive('camouflages')
          }}
          onOpenGameSetup={gameSetup.openSetup} onRetry={feed.retry}
          onOpen={openPost} onToggleSaved={library.toggleFavorite} onUninstall={library.requestUninstall}
        /> : <CamouflagesPage
          feed={feed} query={searches.camouflages ?? ''} sort={sort} searchInputRef={searchInputRef}
          installedIds={installedIds} installer={skinInstaller}
          isSaved={item => isFavoriteSaved(item, 'camouflage')}
          onQueryChange={value => { setSearch('camouflages', value); feed.setSearchInput(value) }}
          onToggleSort={() => { setSort(current => current === 'recent' ? 'popular' : 'recent'); feed.loadPage(0) }}
          onCancelDownload={cancellation.requestSkinCancellation} onOpen={openPost} onToggleSaved={library.toggleFavorite}
        />}
      </div>
      <BackToTopButton
        key={active}
        enabled={active === 'camouflages' || active === 'downloads' || active === 'sounds'}
        markerRef={searchInputRef} scrollContainerRef={isTauriRuntime ? mainScrollRef : null}
      />
      <AppFooter />
    </main>

    <AppSystemDialogs
      gameSetup={gameSetup} library={library} legalNotice={legalNotice} imageQuality={imageQuality}
      cancellation={cancellation} favoriteToRemove={favoriteToRemove} onFavoriteToRemoveChange={setFavoriteToRemove}
      keepWindowControlsVisible={isTauriRuntime}
    />
    <PostDetailsOverlay
      selected={selected} detail={detail} detailLoading={detailLoading} detailError={detailError}
      imageQuality={imageQuality.quality} canInstall={isTauriRuntime}
      soundLibrary={soundLibrary} skinInstaller={skinInstaller} library={library} gameSetup={gameSetup}
      cancellation={cancellation} downloadableSoundLangGroups={currentSoundLangGroups}
      onSearchSoundHashtag={handleSoundSearchHashtag} onSearchSkinHashtag={handleSearchHashtag}
      onClose={closePost} blockingDialogOpen={Boolean(skinInstaller.duplicatePrompt)}
    />
    <DuplicateSkinDecisionDialog
      candidates={skinInstaller.duplicatePrompt?.candidates ?? []}
      resolving={skinInstaller.resolvingDuplicate} error={skinInstaller.error}
      onLinkExisting={folderName => void skinInstaller.resolveDuplicate('link_existing', folderName)}
      onReplaceExisting={folderName => void skinInstaller.resolveDuplicate('replace_existing', folderName)}
      onInstallCopy={() => void skinInstaller.resolveDuplicate('install_copy')}
      onCancel={() => void skinInstaller.resolveDuplicate('cancel')}
    />
    <DownloadCompletionNotifications
      showNotifications={notificationSettings.preferences.showNotifications}
      soundEnabled={notificationSettings.preferences.soundEnabled} volume={notificationSettings.preferences.volume}
    />
  </div>
}
