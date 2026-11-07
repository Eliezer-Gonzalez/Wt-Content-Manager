import { useEffect, useMemo, useState } from 'react'
import { Activity, Bookmark, ChevronDown, Download, ExternalLink, Gamepad2, Grid2X2, Headphones, Menu, Search, Settings2, Shield, SlidersHorizontal, Star, X } from 'lucide-react'
import { chooseGameInstallation, detectGameInstallations, savedGamePath, validateSavedGamePath, type GameInstall } from './gameInstall'
import { useI18n } from './i18n/I18nProvider'
import { fetchPostDetail, fetchRecentCamouflages, type WtLiveDetail, type WtLiveItem } from './wtLive'

const navigation = [
  { group: 'discover', items: [['home', Grid2X2], ['camouflages', Shield], ['sounds', Headphones]] },
  { group: 'library', items: [['favorites', Bookmark], ['downloads', Download]] },
] as const

function relativeDate(timestamp: number, locale: string) {
  const seconds = Math.max(0, Math.floor(Date.now() / 1000 - timestamp))
  if (seconds < 3600) return locale === 'es' ? `Hace ${Math.max(1, Math.floor(seconds / 60))} min` : `${Math.max(1, Math.floor(seconds / 60))} min ago`
  if (seconds < 86400) return locale === 'es' ? `Hace ${Math.floor(seconds / 3600)} h` : `${Math.floor(seconds / 3600)} h ago`
  return new Date(timestamp * 1000).toLocaleDateString(locale === 'es' ? 'es-CL' : 'en-US', { day: 'numeric', month: 'short' })
}

export default function App() {
  const { t, locale, languages, setLocale } = useI18n()
  const [active, setActive] = useState('camouflages')
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
  const [gameInstall, setGameInstall] = useState<GameInstall | null>(null)
  const [gameLoading, setGameLoading] = useState(true)

  useEffect(() => {
    const controller = new AbortController()
    fetchRecentCamouflages(controller.signal).then(setItems).catch((cause: unknown) => {
      if (cause instanceof Error && cause.name !== 'AbortError') setError(cause.message)
    }).finally(() => setLoading(false))
    return () => controller.abort()
  }, [])

  useEffect(() => {
    let mounted = true
    const detect = async () => {
      try {
        const saved = savedGamePath()
        const validSaved = saved ? await validateSavedGamePath(saved) : null
        const detected = await detectGameInstallations()
        const installs = validSaved
          ? [validSaved, ...detected.filter(install => install.path.toLowerCase() !== validSaved.path.toLowerCase())]
          : detected
        if (mounted) setGameInstall(installs[0] ?? null)
      } catch { if (mounted) setGameInstall(null) }
      finally { if (mounted) setGameLoading(false) }
    }
    void detect()
    return () => { mounted = false }
  }, [])

  useEffect(() => {
    if (!selected) { setDetail(null); return }
    const controller = new AbortController()
    setDetail(null); setDetailError(''); setDetailLoading(true)
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

  async function chooseGameFolder() {
    setGameLoading(true)
    try { const install = await chooseGameInstallation(); if (install) setGameInstall(install) }
    catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)) }
    finally { setGameLoading(false) }
  }

  return <div className="shell">
    <aside className="sidebar">
      <div className="brand"><div className="crest"><Shield size={21}/></div><div><strong>WT CONTENT</strong><small>MANAGER <i>0.1</i></small></div><button className="icon mobile" aria-label={t('openMenu')}><Menu/></button></div>
      <div className="source"><span className="live-dot"/> {t('onlineSource')} <span className="source-name">WT LIVE</span></div>
      <nav>{navigation.map(group => <section key={group.group}><p className="nav-label">{t(group.group)}</p>{group.items.map(([key, Icon]) => <button key={key} className={`nav-item ${active === key ? 'active' : ''}`} onClick={() => setActive(key)}><Icon size={17}/>{t(key)}{key === 'downloads' && <span className="nav-count">0</span>}</button>)}</section>)}</nav>
      <div className="sidebar-bottom"><button className="game-status" onClick={chooseGameFolder} title={t('chooseGameFolder')}><span className="status-symbol"><Gamepad2 size={17}/></span><div><small>{t('game')}</small><strong>{gameInstall ? `${t('installedAt')} ${gameInstall.path}` : gameLoading ? t('detecting') : t('notDetected')}</strong></div><span className={gameInstall ? 'live-dot' : 'warning-dot'}/></button><button className="nav-item"><Settings2 size={17}/>{t('settings')}</button><div className="profile"><div className="avatar">P</div><div><strong>{t('profileLocal')}</strong><small>{t('libraryLocal')}</small></div><ChevronDown size={15}/></div></div>
    </aside>
    <main>
      <header className="topbar"><div className="crumb">WT LIVE <span>/</span> <b>{t(active).toUpperCase()}</b></div><div className="top-actions"><span className="sync"><Activity size={14}/> {t('catalog')}</span><label className="locale-picker"><span>{t('language')}</span><select value={locale} onChange={event => setLocale(event.target.value)} aria-label={t('language')}>{languages.map(language => <option key={language.code} value={language.code}>{language.name}</option>)}</select></label><button className="icon" aria-label={t('favorites')} onClick={() => setActive('favorites')}><Bookmark size={17}/></button></div></header>
      <div className="content">
        <section className="intro"><div><div className="eyebrow"><span/> {t('communityContent')}</div><h1>{t('recentTitle').split(' ').slice(0,-1).join(' ')}<br/><em>{t('recentTitle').split(' ').slice(-1)[0]}</em></h1><p>{t('recentSubtitle')}</p></div><div className="intro-mark"><Shield size={74} strokeWidth={0.8}/><span>WT LIVE<br/>COMMUNITY FEED</span></div></section>
        <section className="toolbar"><div className="search"><Search size={17}/><input value={query} onChange={event => setQuery(event.target.value)} placeholder={t('searchPlaceholder')}/><kbd>⌘ K</kbd></div><button className="filter-button" disabled><SlidersHorizontal size={16}/> {t('filters')} <span className="filter-number">0</span></button></section>
        <div className="section-heading"><div><h2>{active === 'favorites' ? t('favorites') : t('latestPosts')}</h2><p>{loading ? t('loading') : error ? t('catalogError') : <>{t('updatedFrom')} <span className="live-dot"/></>}</p></div><div className="sort">{t('sortBy')} <button onClick={() => setSort(sort === 'recent' ? 'popular' : 'recent')}>{t(sort)}<ChevronDown size={14}/></button></div></div>
        <div className="category-row"><span className="category active">{t('all')}</span><span className="result-count">{visible.length} {t('posts')}</span></div>
        {error ? <div className="empty-state"><p>{error}</p><button className="primary" onClick={() => location.reload()}>{t('retry')}</button></div> : loading ? <div className="empty-state">{t('loading')}</div> : visible.length === 0 ? <div className="empty-state">{t('notFound')}</div> : <div className="grid">{visible.map(item => <article className="card" key={item.id} onClick={() => setSelected(item)}><div className="card-image" style={item.imageUrl ? { backgroundImage: `linear-gradient(180deg,transparent 48%,rgba(9,12,9,.72)),url('${item.imageUrl}')` } : undefined}><span className="nation">{t('camouflage')}</span><button className={`save ${saved.includes(item.id) ? 'saved' : ''}`} onClick={event => { event.stopPropagation(); setSaved(current => current.includes(item.id) ? current.filter(id => id !== item.id) : [...current, item.id]) }} aria-label={t('favorites')}><Bookmark size={16}/></button><span className="score"><Star size={12} fill="currentColor"/> {item.likes}</span></div><div className="card-body"><div className="card-title"><h3>{item.title}</h3><span>{relativeDate(item.createdAt, locale)}</span></div><p className="vehicle">{item.fileName ?? t('camouflageForGame')}</p><div className="card-footer"><span>{t('by')} <b>{item.author}</b></span><button onClick={event => { event.stopPropagation(); setSelected(item) }}>{t('viewPost')} <ExternalLink size={13}/></button></div></div></article>)}</div>}
        <footer><span>{t('dataSource')}</span><span>WT CONTENT MANAGER <b>0.1.0</b></span></footer>
      </div>
    </main>
    {selected && <div className="overlay" onClick={() => setSelected(null)}><section className="detail" onClick={event => event.stopPropagation()}><button className="close" onClick={() => setSelected(null)} aria-label={t('close')}><X/></button><div className="detail-copy"><div className="eyebrow"><Shield size={13}/> {t('detailSource')}</div><h2>{selected.title}</h2><p className="vehicle">{selected.fileName ?? t('camouflage')} · {t('by')} {selected.author}</p>{detailLoading ? <p className="detail-loading">{t('detailLoading')}</p> : detailError ? <p className="detail-loading">{detailError}</p> : <div className="detail-description">{detail?.description.some(block => block.type === 'image') ? detail.description.map((block, index) => block.type === 'image' ? <img className="detail-gallery-image" key={`${block.src}-${index}`} src={block.src} alt={block.alt} loading="lazy"/> : <p key={index}>{block.text}</p>) : <>{selected.imageUrl && <img className="detail-gallery-image" src={selected.imageUrl} alt={selected.title} loading="lazy"/>}<p>{selected.description || t('noDescription')}</p></>}</div>}<div className="detail-author">{selected.likes} {t('likes')} · {selected.downloads} {t('downloadsCount')}</div>{selected.downloadUrl && <a className="primary" href={selected.downloadUrl} target="_blank" rel="noreferrer"><Download size={16}/> {t('downloadFile')} {selected.fileName ?? 'file'}</a>}{detail?.commentsUrl && <a className="original-link" href={detail.commentsUrl} target="_blank" rel="noreferrer">{t('readComments')} <ExternalLink size={13}/></a>}</div></section></div>}
  </div>
}

