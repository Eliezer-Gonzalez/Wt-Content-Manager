import { useEffect, useState } from 'react'
import { Copy, Minus, Shield, Square, X } from 'lucide-react'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { useI18n } from '../i18n/I18nContext'
import { AppTooltip } from './ui/AppTooltip'

export function WindowTitleBar() {
  const { t } = useI18n()
  const [maximized, setMaximized] = useState(false)
  const appWindow = getCurrentWindow()

  useEffect(() => {
    let active = true
    let unlisten: (() => void) | undefined
    const syncState = () => { void appWindow.isMaximized().then(value => { if (active) setMaximized(value) }) }
    syncState()
    void appWindow.onResized(syncState).then(stop => {
      if (active) unlisten = stop
      else stop()
    })
    return () => { active = false; unlisten?.() }
  }, [appWindow])

  async function toggleMaximize() {
    await appWindow.toggleMaximize()
    setMaximized(await appWindow.isMaximized())
  }

  return <header className="sticky top-0 z-[60] flex h-9 shrink-0 select-none items-center border-b border-[#30372f] bg-[#1c211c] text-[#d7dccf]" aria-label={t('windowControls')}>
    <div className="flex h-full shrink-0 items-center gap-2 px-3" aria-hidden="true">
      <Shield size={15} className="text-[#aeb990]" />
      <span className="text-[10px] font-semibold tracking-[.12em]">WT CONTENT MANAGER</span>
    </div>
    <div
      className="h-full min-w-0 flex-1 cursor-default"
      data-tauri-drag-region
      onMouseDown={event => { if (event.button === 0) void appWindow.startDragging() }}
      onDoubleClick={event => {
        if ((event.target as HTMLElement).closest('button')) return
        void toggleMaximize()
      }}
      aria-hidden="true"
    />
    <div className="flex h-full shrink-0 items-stretch">
      <AppTooltip content={t('minimizeWindow')} className="h-full" placement="bottom"><button type="button" className="grid h-full w-11 place-items-center text-[#aeb5a7] transition-colors hover:bg-[#30372f] hover:text-white focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-olive" onClick={() => void appWindow.minimize()} aria-label={t('minimizeWindow')}><Minus size={15}/></button></AppTooltip>
      <AppTooltip content={t(maximized ? 'restoreWindow' : 'maximizeWindow')} className="h-full" placement="bottom"><button type="button" className="grid h-full w-11 place-items-center text-[#aeb5a7] transition-colors hover:bg-[#30372f] hover:text-white focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-olive" onClick={() => void toggleMaximize()} aria-label={t(maximized ? 'restoreWindow' : 'maximizeWindow')}>{maximized ? <Copy size={13}/> : <Square size={13}/>}</button></AppTooltip>
      <AppTooltip content={t('closeWindow')} className="h-full" placement="bottom" align="end"><button type="button" className="grid h-full w-12 place-items-center text-[#aeb5a7] transition-colors hover:bg-[#a83f37] hover:text-white focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-red-300" onClick={() => void appWindow.close()} aria-label={t('closeWindow')}><X size={15}/></button></AppTooltip>
    </div>
  </header>
}
