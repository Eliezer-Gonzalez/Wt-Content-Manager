import { useCallback, useEffect, useMemo, useState } from 'react'
import { Activity, Bookmark, ChevronDown, Search, Shield, SlidersHorizontal } from 'lucide-react'
import { GameSetupModal } from './components/GameSetupModal'
import { NavigationSidebar } from './components/NavigationSidebar'
import { PostCard } from './components/PostCard'
import { PostDetailDialog } from './components/PostDetailDialog'
import { Button } from './components/ui/Button'
import { APP_VERSION } from './lib/appInfo'
import { useGameInstallation } from './hooks/useGameInstallation'
import { isTauriRuntime } from './gameInstall'
import { useI18n } from './i18n/I18nProvider'
import { installSkin } from './skins'
import { fetchPostDetail, fetchRecentCamouflages, type WtLiveDetail, type WtLiveItem } from './wtLive'

export default function App() {
  const { t, locale, languages, setLocale } = useI18n()
  const gameSetup = useGameInstallation()
  const [active, setActive] = useState('camouflages')
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<'recent' | 'popular'>('recent')
  const [items, setItems] = useState<WtLiveItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState<WtLiveItem | null>(null)
  const [detail, setDetail] = useState<WtLiveDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState('')
  const [saved, setSaved] = useState<number[]>([])
  const [installingSkin, setInstallingSkin] = useState(false)
  const [installError, setInstallError] = useState('')
  const [installedPath, setInstalledPath] = useState('')

  const closeMobileMenu = useCallback(() => setMobileMenuOpen(false), [])

  useEffect(() => {
    const controller = new AbortController()
    fetchRecentCamouflages(controller.signal).then(setItems).catch((cause: unknown) => {
      if (cause instanceof Error && cause.name !== 'AbortError') setError(cause.message)
    }).finally(() => setLoading(false))
    return () => controller.abort()
  }, [])

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

  const visible = useMemo(() => {
    const filtered = items.filter(item =>
      (active !== 'favorites' || saved.includes(item.id)) &&
      `${item.title} ${item.author} ${item.fileName ?? ''}`.toLowerCase().includes(query.toLowerCase()),
    )
    return sort === 'popular'
      ? [...filtered].sort((a, b) => b.likes - a.likes)
      : [...filtered].sort((a, b) => b.createdAt - a.createdAt)
  }, [active, items, query, saved, sort])

  function toggleSaved(id: number) {
    setSaved(current => current.includes(id) ? current.filter(itemId => itemId !== id) : [...current, id])
  }

  async function handleInstallSkin() {
    if (!selected) return
    if (!gameSetup.gameInstall) {
      gameSetup.openSetup()
      return
    }
    setInstallingSkin(true)
    setInstallError('')
    setInstalledPath('')
    try {
      const result = await installSkin(selected.langGroup, gameSetup.gameInstall.path)
      setInstalledPath(result.path)
    } catch (cause) {
      setInstallError(cause instanceof Error ? cause.message : t('skinInstallFailed'))
    } finally {
      setInstallingSkin(false)
    }
  }

  const titleWords = t('recentTitle').split(' ')
  const titleFirstLine = titleWords.slice(0, -1).join(' ')
  const titleLastWord = titleWords[titleWords.length - 1]

  return <div className="min-h-screen bg-wt-bg font-sans text-[#e3e4dc]">
    <NavigationSidebar
      active={active}
      mobileOpen={mobileMenuOpen}
      gameInstall={gameSetup.gameInstall}
      gameLoading={gameSetup.loading}
      t={t}
      onNavigate={setActive}
      onOpenGameSetup={gameSetup.openSetup}
      onToggleMobile={() => setMobileMenuOpen(open => !open)}
      onCloseMobile={closeMobileMenu}
    />

    <main className="min-h-screen ml-[246px] max-[1100px]:ml-[210px] max-[720px]:ml-0">
      <header className="flex h-[59px] items-center justify-between border-b border-[#2c332c] px-[42px] max-[1100px]:px-[26px] max-[720px]:h-12 max-[720px]:px-[17px]">
        <div className="text-[10px] tracking-[.13em] text-[#a0a99c]">WT LIVE <span className="px-2 text-[#717b6e]">/</span> <b className="font-medium text-[#d3d7ca]">{t(active).toUpperCase()}</b></div>
        <div className="flex items-center gap-3 min-[721px]:gap-5">
          <span className="flex items-center gap-1.5 text-xs text-[#a1a99b] max-[520px]:hidden"><Activity size={14}/>{t('catalog')}</span>
          <label className="flex items-center gap-1.5 text-xs text-[#a1a99b]"><span className="sr-only min-[521px]:not-sr-only">{t('language')}</span><select className="border border-[#343b32] bg-wt-panel px-2 py-1.5 text-xs text-[#d3d7ca] focus-visible:outline-2 focus-visible:outline-olive" value={locale} onChange={event => setLocale(event.target.value)} aria-label={t('language')}>{languages.map(language => <option key={language.code} value={language.code}>{language.name}</option>)}</select></label>
          <Button variant="icon" aria-label={t('favorites')} onClick={() => setActive('favorites')}><Bookmark size={17}/></Button>
        </div>
      </header>

      <div className="mx-auto max-w-[1260px] px-[42px] pb-5 pt-10 max-[1100px]:px-[26px] max-[720px]:px-4 max-[720px]:pt-6">
        <section className="flex min-h-[218px] items-center justify-between border-b border-[#31372f] px-[3px] pb-6 max-[720px]:min-h-[180px]">
          <div><p className="mb-0 flex items-center gap-2 text-[10px] tracking-[.14em] text-[#a0aa8a]"><span className="h-px w-3.5 bg-[#acb98b]"/>{t('communityContent')}</p><h1 className="mb-3 mt-[18px] font-display text-[54px] font-semibold leading-[.97] tracking-[-.02em] text-[#e6e7dd] max-[720px]:text-[44px]">{titleFirstLine}<br/><em className="not-italic text-[#aeb990]">{titleLastWord}</em></h1><p className="mb-0 max-w-[38ch] text-sm leading-6 text-[#adb3a8]">{t('recentSubtitle')}</p></div>
          <div className="mr-[8%] flex h-[142px] w-[170px] flex-col items-center justify-center gap-2 border border-[#30382e] bg-gradient-to-br from-[#22281f] to-[#1a1f19] text-center text-[#89927d] max-[1100px]:mr-0 max-[720px]:h-[105px] max-[720px]:w-[100px] max-[420px]:hidden"><Shield size={64} strokeWidth={0.8} className="text-[#59654d] max-[720px]:size-[45px]"/><span className="text-[9px] leading-relaxed tracking-[.18em]">WT LIVE<br/>COMMUNITY FEED</span></div>
        </section>

        <section className="my-[22px] mb-[31px] flex gap-2.5 max-[720px]:mb-6 max-[720px]:mt-[17px]">
          <label className="flex h-11 max-w-[490px] flex-1 items-center gap-2.5 border border-[#343b32] bg-wt-panel px-3 text-[#a0aa9b] focus-within:border-[#717d5b]"><Search size={17}/><input className="min-w-0 flex-1 bg-transparent text-sm text-[#e2e5db] outline-none placeholder:text-[#929a8e]" value={query} onChange={event => setQuery(event.target.value)} placeholder={t('searchPlaceholder')}/><kbd className="border border-[#41483d] px-1.5 py-0.5 text-[10px] text-[#929a8e] max-[720px]:hidden">⌘ K</kbd></label>
          <Button className="h-11" disabled><SlidersHorizontal size={16}/>{t('filters')}<span className="bg-[#38422f] px-1.5 py-0.5 text-[10px] text-[#bdc99e]">0</span></Button>
        </section>

        <div className="flex items-end justify-between gap-4">
          <div><h2 className="mb-1 text-lg font-medium tracking-tight">{active === 'favorites' ? t('favorites') : t('latestPosts')}</h2><p className="mb-0 flex items-center gap-2 text-xs text-[#a1a99b]">{loading ? t('loading') : error ? t('catalogError') : <>{t('updatedFrom')} <span className="inline-block size-1.5 rounded-full bg-[#9cae70]"/></>}</p></div>
          <div className="flex items-center gap-2 text-xs text-[#a1a99b]">{t('sortBy')}<Button variant="quiet" className="min-h-9 px-2 text-xs" onClick={() => setSort(sort === 'recent' ? 'popular' : 'recent')}>{t(sort)}<ChevronDown size={14}/></Button></div>
        </div>
        <div className="mb-3.5 mt-5 flex items-center gap-2"><span className="border border-[#414a39] bg-[#2b3328] px-2.5 py-1.5 text-xs text-[#dbe0d1]">{t('all')}</span><span className="ml-auto text-[11px] text-[#929a8e]">{visible.length} {t('posts')}</span></div>

        {error ? <div className="grid min-h-40 place-items-center text-center"><div><p className="text-sm text-[#c2c8bb]">{error}</p><Button variant="primary" onClick={() => location.reload()}>{t('retry')}</Button></div></div>
          : loading ? <div className="grid min-h-40 place-items-center text-sm text-[#b1b7ab]">{t('loading')}</div>
            : visible.length === 0 ? <div className="grid min-h-40 place-items-center text-sm text-[#b1b7ab]">{t('notFound')}</div>
              : <div className="grid grid-cols-3 gap-3 max-[1100px]:grid-cols-2 max-[720px]:gap-2.5 max-[420px]:grid-cols-1">{visible.map(item => <PostCard key={item.id} item={item} locale={locale} isSaved={saved.includes(item.id)} t={t} onOpen={setSelected} onToggleSaved={toggleSaved}/>)}</div>}

        <footer className="mt-7 flex justify-between gap-3 border-t border-[#2d342d] px-1 py-3 text-[10px] tracking-[.06em] text-[#8d968a] max-[420px]:flex-col"><span>{t('dataSource')}</span><span>WT CONTENT MANAGER <b className="font-medium text-[#b2baa9]">{APP_VERSION}</b></span></footer>
      </div>
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
    {selected && <PostDetailDialog item={selected} detail={detail} loading={detailLoading} error={detailError} t={t} canInstall={isTauriRuntime} installing={installingSkin} installError={installError} installedPath={installedPath} onInstall={() => void handleInstallSkin()} onChooseGame={gameSetup.openSetup} onClose={() => setSelected(null)}/>}
  </div>
}
