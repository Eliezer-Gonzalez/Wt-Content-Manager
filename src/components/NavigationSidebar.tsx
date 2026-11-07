import { useEffect } from 'react'
import { Bookmark, ChevronDown, Download, Gamepad2, Grid2X2, Headphones, Menu, Settings2, Shield, X } from 'lucide-react'
import { Button } from './ui/Button'
import type { GameInstall } from '../gameInstall'
import { APP_VERSION } from '../lib/appInfo'

const navigation = [
  { group: 'discover', items: [['home', Grid2X2], ['camouflages', Shield], ['sounds', Headphones]] },
  { group: 'library', items: [['favorites', Bookmark], ['downloads', Download]] },
] as const

type Props = {
  active: string
  mobileOpen: boolean
  gameInstall: GameInstall | null
  gameLoading: boolean
  installedCount: number
  t: (key: string) => string
  onNavigate: (key: string) => void
  onOpenGameSetup: () => void
  onToggleMobile: () => void
  onCloseMobile: () => void
}

export function NavigationSidebar({ active, mobileOpen, gameInstall, gameLoading, installedCount, t, onNavigate, onOpenGameSetup, onToggleMobile, onCloseMobile }: Props) {
  useEffect(() => {
    if (!mobileOpen) return
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCloseMobile()
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [mobileOpen, onCloseMobile])

  const mobileLayout = mobileOpen
    ? 'max-[720px]:fixed max-[720px]:inset-y-0 max-[720px]:left-0 max-[720px]:z-50 max-[720px]:flex max-[720px]:h-dvh max-[720px]:w-[min(300px,88vw)] max-[720px]:flex-col max-[720px]:overflow-y-auto max-[720px]:border-b-0 max-[720px]:px-[17px] max-[720px]:pb-[14px] max-[720px]:pt-[10px] max-[720px]:shadow-2xl'
    : 'max-[720px]:static max-[720px]:inset-auto max-[720px]:h-auto max-[720px]:w-full max-[720px]:border-r-0 max-[720px]:border-b max-[720px]:border-[#30372f] max-[720px]:block max-[720px]:px-[15px] max-[720px]:py-[10px]'
  return <>
    {mobileOpen && <button className="fixed inset-0 z-40 bg-black/70 min-[721px]:hidden" aria-label={t('closeMenu')} onClick={onCloseMobile}/>}
    <aside className={`fixed inset-y-0 left-0 z-20 flex w-[246px] flex-col border-r border-[#2c332c] bg-[#1c211c] px-[17px] pb-[14px] pt-[25px] transition-[width,transform] duration-200 min-[721px]:max-[1100px]:w-[210px] max-[720px]:transition-none ${mobileLayout}`} aria-label={t('navigation')}>
      <div className="flex h-[52px] shrink-0 items-center gap-[11px] px-2 max-[720px]:h-[42px]">
        <div className="grid size-9 shrink-0 place-items-center border border-[#626b51] bg-[#293027] text-[#bcc899]"><Shield size={21}/></div>
        <div><strong className="block text-xs font-bold tracking-[.09em]">WT CONTENT</strong><small className="mt-[3px] block text-[10px] tracking-[.16em] text-[#9ca38f]">MANAGER <i className="ml-1 border border-[#47513e] px-1 text-[9px] not-italic text-[#c2c8ae]">{APP_VERSION}</i></small></div>
        <Button variant="icon" className="ml-auto !hidden max-[720px]:!inline-flex" aria-label={mobileOpen ? t('closeMenu') : t('openMenu')} aria-expanded={mobileOpen} aria-controls="primary-navigation" onClick={onToggleMobile}>{mobileOpen ? <X size={20}/> : <Menu size={20}/>}</Button>
      </div>
      <div className={`mb-6 mt-7 items-center justify-between px-2 text-[10px] tracking-[.12em] text-[#8f988b] ${mobileOpen ? 'flex max-[720px]:mt-7' : 'flex max-[720px]:hidden'}`}><span><span className="mr-2 inline-block size-1.5 rounded-full bg-[#9cae70]"/>{t('onlineSource')}</span><span className="text-[#bac49c]">WT LIVE</span></div>
      <nav id="primary-navigation" className={`block flex-1 ${mobileOpen ? 'max-[720px]:mt-5 max-[720px]:block' : 'max-[720px]:hidden'}`}>
        {navigation.map(group => <section key={group.group} className="mb-[26px]">
          <p className="mb-[9px] ml-[10px] text-[10px] tracking-[.13em] text-[#858e81]">{t(group.group)}</p>
          {group.items.map(([key, Icon]) => <button key={key} className={`flex h-10 w-full items-center gap-[11px] border-l-2 px-[10px] text-left text-[13px] transition-colors ${active === key ? 'border-olive bg-[#293027] text-[#dfe4d2]' : 'border-transparent text-[#b1b7ab] hover:bg-[#252b24] hover:text-[#e7e8df]'}`} onClick={() => { onNavigate(key); onCloseMobile() }}><Icon size={17}/>{t(key)}{key === 'downloads' && <span className="ml-auto text-[11px] text-[#90998a]">{installedCount}</span>}</button>)}
        </section>)}
      </nav>
      <div className={`mt-auto ${mobileOpen ? 'max-[720px]:mt-auto max-[720px]:block' : 'max-[720px]:hidden'}`}>
        <button className="relative mb-[13px] flex w-full items-center gap-2.5 border border-[#333b31] bg-[#242a23] p-3 text-left hover:border-[#717d5b]" onClick={onOpenGameSetup} title={t('chooseGameFolder')}>
          <span className="text-[#aeb993]"><Gamepad2 size={17}/></span><span className="min-w-0 flex-1"><small className="block text-[10px] tracking-[.1em] text-[#a9b09e]">{t('game')}</small><strong className="mt-1 block max-w-[175px] truncate text-[11px] font-medium text-[#d1d4c9]">{gameInstall ? `${t('installedAt')} ${gameInstall.path}` : gameLoading ? t('detecting') : t('notDetected')}</strong></span><span className={`size-1.5 rounded-full ${gameInstall ? 'bg-[#9cae70]' : 'bg-[#c29459]'}`}/>
        </button>
        <button className="flex h-10 w-full items-center gap-[11px] border-l-2 border-transparent px-[10px] text-left text-[13px] text-[#b1b7ab] hover:bg-[#252b24]" type="button"><Settings2 size={17}/>{t('settings')}</button>
        <div className="mt-4 flex items-center gap-[9px] border-t border-[#313830] px-[5px] pb-0 pt-[14px]"><span className="grid size-[29px] place-items-center bg-[#454b3b] text-xs text-[#e1e5d4]">P</span><span className="min-w-0 flex-1"><strong className="block text-xs font-medium">{t('profileLocal')}</strong><small className="mt-1 block text-[10px] text-[#9da596]">{t('libraryLocal')}</small></span><ChevronDown size={15} className="text-[#879080]"/></div>
      </div>
    </aside>
  </>
}
