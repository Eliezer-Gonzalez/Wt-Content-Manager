import { useCallback, useEffect, useMemo, useState } from 'react'
import { Activity, ChevronDown, Search } from 'lucide-react'
import { GameSetupModal } from './components/GameSetupModal'
import { NavigationSidebar } from './components/NavigationSidebar'
import { PostCard } from './components/PostCard'
import { PostDetailDialog } from './components/PostDetailDialog'
import { PostCardSkeleton } from './components/PostCardSkeleton'
import { InstalledSkinCard } from './components/InstalledSkinCard'
import { PaginatedGrid } from './components/PaginatedGrid'
import { JustifiedPostGrid } from './components/JustifiedPostGrid'
import { MasonryPostGrid } from './components/MasonryPostGrid'
import { PostLayoutToggle } from './components/PostLayoutToggle'
import { SoundComingSoon } from './components/SoundComingSoon'
import { PeriodFilter } from './components/PeriodFilter'
import { EmptyLibraryState } from './components/EmptyLibraryState'
import { HomeDashboard } from './components/HomeDashboard'
import { WindowTitleBar } from './components/WindowTitleBar'
import { Button } from './components/ui/Button'
import { APP_VERSION } from './lib/appInfo'
import { useGameInstallation } from './hooks/useGameInstallation'
import { useLocalLibrary } from './hooks/useLocalLibrary'
import { useSkinInstaller } from './hooks/useSkinInstaller'
import { useSectionSearch } from './hooks/useSectionSearch'
import { usePostLayout } from './hooks/usePostLayout'
import { isTauriRuntime } from './gameInstall'
import { useI18n } from './i18n/I18nProvider'
import { fetchPostDetail, fetchRecentCamouflages, type WtLiveDetail, type WtLiveFeedSort, type WtLiveItem } from './wtLive'
import { WT_LIVE_HEADER_IMAGE } from './lib/wtLiveAssets'

export default function App() {
  const { t, locale, languages, setLocale } = useI18n()
  const gameSetup = useGameInstallation()
  const library = useLocalLibrary()
  const [active, setActive] = useState('camouflages')
  const [postLayout, setPostLayout] = usePostLayout()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const { searches, setSearch } = useSectionSearch()
  const query = searches[active] ?? ''
  const [sort, setSort] = useState<'recent' | 'popular'>('recent')
  const [items, setItems] = useState<WtLiveItem[]>([])
  const [feedSearch, setFeedSearch] = useState('')
  const [period, setPeriod] = useState<0 | 7 | 90 | 180>(7)
  const [feedPage, setFeedPage] = useState(0)
  const [feedHasMore, setFeedHasMore] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [loadMoreError, setLoadMoreError] = useState('')
  const [feedRetry, setFeedRetry] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState<WtLiveItem | null>(null)
  const [detail, setDetail] = useState<WtLiveDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState('')
  const skinInstaller = useSkinInstaller({ gamePath: gameSetup.gameInstall?.path, selectionKey: selected?.id, t, onInstalled: library.recordInstallation })
  const feedSort: WtLiveFeedSort = active === 'camouflages' && sort === 'popular' ? 'rating' : 'created'

  const closeMobileMenu = useCallback(() => setMobileMenuOpen(false), [])

  useEffect(() => {
    const timer = window.setTimeout(() => setFeedSearch(query.trim()), 300)
    return () => window.clearTimeout(timer)
  }, [query])

  useEffect(() => {
    if (active === 'favorites' || active === 'downloads' || active === 'sounds') return
    const controller = new AbortController()
    const isLoadingMore = feedPage > 0
    if (isLoadingMore) {
      setLoadingMore(true)
      setLoadMoreError('')
    } else {
      setLoading(true)
      setError('')
      setLoadMoreError('')
      setFeedHasMore(false)
    }
    fetchRecentCamouflages(controller.signal, feedSearch, period, feedPage, feedSort).then(pageItems => {
      setItems(current => {
        if (feedPage === 0) return pageItems
        const existingIds = new Set(current.map(item => item.id))
        return [...current, ...pageItems.filter(item => !existingIds.has(item.id))]
      })
      setFeedHasMore(pageItems.length === 25)
    }).catch((cause: unknown) => {
      if (cause instanceof Error && cause.name !== 'AbortError') {
        if (isLoadingMore) {
          setLoadMoreError(cause.message)
        }
        else setError(cause.message)
      }
    }).finally(() => {
      if (controller.signal.aborted) return
      setLoading(false)
      setLoadingMore(false)
    })
    return () => controller.abort()
  }, [active, feedSearch, period, feedPage, feedRetry, feedSort])

  useEffect(() => {
    if (!selected) { setDetail(null); return }
    const controller = new AbortController()
    setDetail(null)
    setDetailError('')
    setDetailLoading(true)
    fetchPostDetail(selected, controller.signal).then(setDetail).catch((cause: unknown) => {
      if (cause instanceof Error && cause.name !== 'AbortError') setDetailError(cause.message)
    }).finally(() => setDetailLoading(false))
    return () => controller.abort()
  }, [selected])

  const catalog = active === 'favorites' ? library.favorites : items
  const visible = useMemo(() => {
    if (active !== 'favorites') return catalog
    const filtered = catalog.filter(item =>
      `${item.title} ${item.author} ${item.fileName ?? ''} ${item.description}`.toLowerCase().includes(query.toLowerCase()),
    )
    return sort === 'popular'
      ? [...filtered].sort((a, b) => b.likes - a.likes)
      : [...filtered].sort((a, b) => b.createdAt - a.createdAt)
  }, [active, catalog, query, sort])

  const visibleInstallations = useMemo(() => library.installedSkins.filter(entry =>
    `${entry.item.title} ${entry.item.author} ${entry.item.fileName ?? ''} ${entry.folderName}`.toLowerCase().includes(query.toLowerCase()),
  ), [library.installedSkins, query])

  async function handleInstallSkin() {
    if (!selected) return
    if (!gameSetup.gameInstall) {
      gameSetup.openSetup()
      return
    }
    void skinInstaller.install(selected)
  }

  const isLocalLibrary = active === 'downloads' || active === 'favorites'
  const pageTitle = active === 'downloads' ? t('downloads') : active === 'favorites' ? t('favorites') : t('recentTitle')
  const titleWords = pageTitle.split(' ')
  const titleFirstLine = titleWords.slice(0, -1).join(' ')
  const titleLastWord = titleWords[titleWords.length - 1]
  const selectedPeriodLabel = period === 7 ? 'periodWeek' : period === 90 ? 'periodThreeMonths' : period === 180 ? 'periodSixMonths' : 'periodAll'

  return <div className={`${isTauriRuntime ? 'h-dvh overflow-hidden' : 'min-h-screen'} bg-wt-bg font-sans text-[#e3e4dc]`} onContextMenu={event => event.preventDefault()}>
    {isTauriRuntime && <WindowTitleBar t={t}/>}
    <NavigationSidebar
      active={active}
      hasCustomTitleBar={isTauriRuntime}
      mobileOpen={mobileMenuOpen}
      gameInstall={gameSetup.gameInstall}
      gameLoading={gameSetup.loading}
      installedCount={library.installedSkins.length}
      t={t}
      onNavigate={key => {
        setActive(key)
        if (key === 'camouflages' || key === 'home') {
          setFeedPage(0)
          setFeedHasMore(false)
          setLoadMoreError('')
        }
      }}
      onOpenGameSetup={gameSetup.openSetup}
      onToggleMobile={() => setMobileMenuOpen(open => !open)}
      onCloseMobile={closeMobileMenu}
    />

    <main className={`ml-[246px] flex flex-col max-[1100px]:ml-[210px] max-[720px]:ml-0 ${isTauriRuntime ? 'h-[calc(100dvh-36px)] min-h-0 overflow-y-auto [overflow-anchor:none]' : 'min-h-screen'}`}>
      <header className="flex h-[59px] shrink-0 items-center justify-between border-b border-[#2c332c] px-[42px] max-[1100px]:px-[26px] max-[720px]:h-12 max-[720px]:px-[17px]">
        <div className="text-[10px] tracking-[.13em] text-[#a0a99c]">WT LIVE <span className="px-2 text-[#717b6e]">/</span> <b className="font-medium text-[#d3d7ca]">{t(active).toUpperCase()}</b></div>
        <div className="flex items-center gap-3 min-[721px]:gap-5">
          <span className="flex items-center gap-1.5 text-xs text-[#a1a99b] max-[520px]:hidden"><Activity size={14}/>{t('catalog')}</span>
          <label className="flex items-center gap-1.5 text-xs text-[#a1a99b]"><span className="sr-only min-[521px]:not-sr-only">{t('language')}</span><select className="border border-[#343b32] bg-wt-panel px-2 py-1.5 text-xs text-[#d3d7ca] focus-visible:outline-2 focus-visible:outline-olive" value={locale} onChange={event => setLocale(event.target.value)} aria-label={t('language')}>{languages.map(language => <option key={language.code} value={language.code}>{language.name}</option>)}</select></label>
        </div>
      </header>

      <div className="flex flex-1 flex-col">
      {active === 'sounds' ? <SoundComingSoon t={t}/> : active === 'home' ? <HomeDashboard
        items={items}
        favoritesCount={library.favorites.length}
        installedCount={library.installedSkins.length}
        gameConfigured={Boolean(gameSetup.gameInstall)}
        loading={loading}
        error={error}
        locale={locale}
        t={t}
        isSaved={item => library.favorites.some(saved => saved.id === item.id)}
        onNavigate={section => {
          setActive(section)
          if (section === 'camouflages') { setFeedPage(0); setFeedHasMore(false); setLoadMoreError('') }
        }}
        onOpenGameSetup={gameSetup.openSetup}
        onRetry={() => setFeedRetry(retry => retry + 1)}
        onOpen={setSelected}
        onToggleSaved={library.toggleFavorite}
      /> : <div className="flex w-full flex-1 flex-col px-8 pb-5 pt-10 max-[1100px]:px-6 max-[720px]:px-4 max-[720px]:pt-6">
        <section className={`relative flex items-center justify-between border-b border-[#31372f] px-[3px] pb-6 ${isLocalLibrary ? 'min-h-[150px]' : 'min-h-[218px] max-[720px]:min-h-[180px]'}`}>
          {active === 'camouflages' && <div className="pointer-events-none absolute -top-10 inset-x-0 bottom-0 overflow-hidden" aria-hidden="true">
            <img src={WT_LIVE_HEADER_IMAGE} alt="" className="size-full origin-left scale-[1.2] object-cover object-[82%_48%] opacity-85" />
            <span className="absolute inset-0 bg-gradient-to-r from-wt-bg/95 via-wt-bg/70 to-wt-bg/15" />
            <span className="absolute inset-0 bg-gradient-to-b from-wt-bg/5 via-transparent to-wt-bg/15" />
          </div>}
          <div className="relative z-10"><p className="mb-0 flex items-center gap-2 text-[10px] tracking-[.14em] text-[#a0aa8a]"><span className="h-px w-3.5 bg-[#acb98b]"/>{isLocalLibrary ? t('libraryLocal') : t('communityContent')}</p><h1 className={`mb-2 mt-3 font-display font-semibold leading-[.97] tracking-[-.02em] text-[#e6e7dd] ${isLocalLibrary ? 'text-[48px] max-[720px]:text-[40px]' : 'text-[54px] max-[720px]:text-[44px]'}`}>{titleFirstLine && <>{titleFirstLine}<br/></>}<em className="not-italic text-[#aeb990]">{titleLastWord}</em></h1>{!isLocalLibrary && <p className="mb-0 max-w-[38ch] text-sm leading-6 text-[#adb3a8]">{t('recentSubtitle')}</p>}</div>
        </section>

        <section className="my-[22px] mb-[31px] flex gap-2.5 max-[720px]:mb-6 max-[720px]:mt-[17px]">
          <label className="flex h-11 max-w-[490px] flex-1 items-center gap-2.5 border border-[#343b32] bg-wt-panel px-3 text-[#a0aa9b] focus-within:border-[#717d5b]"><Search size={17}/><input className="min-w-0 flex-1 bg-transparent text-sm text-[#e2e5db] outline-none placeholder:text-[#929a8e]" value={query} onChange={event => { setSearch(active, event.target.value); if (active === 'camouflages') setFeedPage(0) }} placeholder={t('searchPlaceholder')}/><kbd className="border border-[#41483d] px-1.5 py-0.5 text-[10px] text-[#929a8e] max-[720px]:hidden">⌘ K</kbd></label>
          {active === 'camouflages' && <PeriodFilter value={period} t={t} onChange={nextPeriod => { setPeriod(nextPeriod); setFeedPage(0) }}/>}
        </section>

        <div className="flex items-end justify-between gap-4">
          <div><h2 className="mb-1 text-lg font-medium tracking-tight">{active === 'favorites' ? t('favorites') : active === 'downloads' ? t('downloads') : t('latestPosts')}</h2>{!isLocalLibrary && <p className="mb-0 flex items-center gap-2 text-xs text-[#a1a99b]">{loading ? t('loading') : error ? t('catalogError') : <>{t('updatedFrom')} <span className="inline-block size-1.5 rounded-full bg-[#9cae70]"/></>}</p>}</div>
          <div className="flex flex-wrap items-center justify-end gap-2 text-xs text-[#a1a99b]">{active === 'camouflages' && <PostLayoutToggle value={postLayout} onChange={setPostLayout} t={t}/>}{active !== 'downloads' && <>{t('sortBy')}<Button variant="quiet" className="min-h-9 px-2 text-xs" onClick={() => {
            setSort(current => current === 'recent' ? 'popular' : 'recent')
            if (active === 'camouflages') { setFeedPage(0); setFeedHasMore(false); setLoadMoreError('') }
          }}>{t(sort)}<ChevronDown size={14}/></Button></>}</div>
        </div>
        <div className="mb-3.5 mt-5 flex items-center gap-2">{active === 'camouflages' && <span className="border border-[#414a39] bg-[#2b3328] px-2.5 py-1.5 text-xs text-[#dbe0d1]">{t(selectedPeriodLabel)}</span>}<span className="ml-auto text-[11px] text-[#929a8e]">{active === 'downloads' ? visibleInstallations.length : visible.length} {t('posts')}</span></div>

        {active === 'downloads' ? visibleInstallations.length === 0
          ? query ? <div className="grid min-h-40 place-items-center text-center text-sm text-[#b1b7ab]">{t('notFound')}</div> : <EmptyLibraryState kind="downloads" t={t} onExplore={() => setActive('camouflages')}/>
          : <PaginatedGrid items={visibleInstallations} resetKey={`downloads-${query}`} gridClassName="grid grid-cols-2 gap-3 min-[1600px]:grid-cols-3 min-[2300px]:grid-cols-4 max-[720px]:grid-cols-1" t={t} getKey={entry => entry.path} renderItem={entry => <InstalledSkinCard entry={entry} locale={locale} t={t} onOpen={setSelected}/>}/>
          : active === 'favorites' ? visible.length === 0
            ? query ? <div className="grid min-h-40 place-items-center text-center text-sm text-[#b1b7ab]">{t('notFound')}</div> : <EmptyLibraryState kind="favorites" t={t} onExplore={() => setActive('camouflages')}/>
            : <PaginatedGrid items={visible} resetKey={`favorites-${query}`} gridClassName="grid grid-cols-2 gap-3 min-[1400px]:grid-cols-3 min-[1800px]:grid-cols-4 min-[2300px]:grid-cols-5 max-[720px]:gap-2.5 max-[420px]:grid-cols-1" t={t} getKey={item => String(item.id)} renderItem={item => <PostCard item={item} locale={locale} isSaved onOpen={setSelected} onToggleSaved={library.toggleFavorite} t={t}/>}/>
          : error ? <div className="grid min-h-40 place-items-center text-center"><div><p className="text-sm text-[#c2c8bb]">{error}</p><Button variant="primary" onClick={() => location.reload()}>{t('retry')}</Button></div></div>
          : loading ? <PostCardSkeleton label={t('loading')}/>
            : visible.length === 0 ? <div className="grid min-h-40 place-items-center text-sm text-[#b1b7ab]">{t('notFound')}</div>
              : <>
                {postLayout === 'justified' ? <JustifiedPostGrid items={visible} renderItem={(item, imageHeight, onImageRatio) => <PostCard item={item} locale={locale} imageHeight={imageHeight} onImageRatio={onImageRatio} isSaved={library.favorites.some(saved => saved.id === item.id)} t={t} onOpen={setSelected} onToggleSaved={library.toggleFavorite}/>} /> : <MasonryPostGrid items={visible} renderItem={item => <PostCard item={item} locale={locale} masonry isSaved={library.favorites.some(saved => saved.id === item.id)} t={t} onOpen={setSelected} onToggleSaved={library.toggleFavorite}/>} />}
                {loadMoreError && <p className="mt-4 text-center text-sm text-amber-200" role="alert">{loadMoreError}</p>}
                {(feedHasMore || loadingMore) && <div className="mt-5 flex justify-center"><Button variant="quiet" disabled={loadingMore} onClick={() => loadMoreError ? setFeedRetry(retry => retry + 1) : setFeedPage(page => page + 1)}>{loadingMore ? t('loadingMore') : t(loadMoreError ? 'retry' : 'loadMore')}</Button></div>}
              </>}

      </div>}
      </div>
      <footer className="mx-8 mt-auto flex justify-between gap-3 border-t border-[#2d342d] px-1 py-3 text-[10px] tracking-[.06em] text-[#8d968a] max-[1100px]:mx-6 max-[720px]:mx-4 max-[420px]:flex-col"><span>{t('dataSource')}</span><span>WT CONTENT MANAGER <b className="font-medium text-[#b2baa9]">{APP_VERSION}</b></span></footer>
    </main>

    <GameSetupModal
      open={gameSetup.isOpen}
      loading={gameSetup.loading}
      error={gameSetup.error}
      installations={gameSetup.installations}
      selected={gameSetup.selected}
      t={t}
      onSelect={gameSetup.selectInstallation}
      onConfirm={gameSetup.confirmInstallation}
      onRescan={() => void gameSetup.scan()}
      onChooseManual={() => void gameSetup.chooseManual(t('gameSetupPickerTitle'))}
      onClose={gameSetup.closeSetup}
    />
    {selected && <PostDetailDialog item={selected} detail={detail} loading={detailLoading} error={detailError} t={t} canInstall={isTauriRuntime} installing={skinInstaller.installing} installProgress={skinInstaller.progress} installPaused={skinInstaller.paused} installCancelling={skinInstaller.cancelling} installCancelled={skinInstaller.cancelled} installError={skinInstaller.error} installedPath={skinInstaller.installedPath} onInstall={() => void handleInstallSkin()} onPauseDownload={() => void skinInstaller.togglePause()} onCancelDownload={() => void skinInstaller.cancel()} onChooseGame={gameSetup.openSetup} onSearchHashtag={tag => { setSearch("camouflages", `#${tag}`); setActive("camouflages"); setFeedPage(0); setFeedHasMore(false); setLoadMoreError(""); setSelected(null) }} onClose={() => setSelected(null)}/>}
  </div>
}
