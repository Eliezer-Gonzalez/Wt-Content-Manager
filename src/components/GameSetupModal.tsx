import { useRef } from 'react'
import type { KeyboardEvent } from 'react'
import { Check, FolderOpen, LoaderCircle, RefreshCw, X } from 'lucide-react'
import { Button } from './ui/Button'
import { useFocusTrap } from '../hooks/useFocusTrap'
import type { GameInstall } from '../lib/gameInstall'
import { useI18n } from '../i18n/I18nContext'
import { formatAppError } from '../lib/appError'

type Props = {
  open: boolean
  loading: boolean
  error: unknown
  installations: GameInstall[]
  selected: GameInstall | null
  canDismiss?: boolean
  onSelect: (install: GameInstall) => void
  onConfirm: (install: GameInstall) => void
  onRescan: () => void
  onChooseManual: () => void
  onClose: () => void
}

export function GameSetupModal({
  open,
  loading,
  error,
  installations,
  selected,
  canDismiss = true,
  onSelect,
  onConfirm,
  onRescan,
  onChooseManual,
  onClose,
}: Props) {
  const { t } = useI18n()
  const dialogRef = useRef<HTMLDivElement>(null)
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const radioRefs = useRef<(HTMLButtonElement | null)[]>([])
  const errorMessage = error ? formatAppError(error, t).message : ''

  useFocusTrap({
    containerRef: dialogRef,
    initialFocusRef: closeButtonRef,
    onClose,
    enabled: open,
    canEscape: canDismiss,
  })

  function handleRadioKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const count = installations.length
    let next: number
    if (event.key === 'ArrowDown' || event.key === 'ArrowRight') next = (index + 1) % count
    else if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') next = (index - 1 + count) % count
    else return
    event.preventDefault()
    onSelect(installations[next])
    radioRefs.current[next]?.focus()
  }

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/80 p-4"
      onMouseDown={event => {
        if (canDismiss && event.target === event.currentTarget) onClose()
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="game-setup-title"
        className="max-h-[calc(100dvh-2rem)] w-full max-w-[560px] overflow-y-auto border border-[#46503f] bg-wt-panel p-0 text-[#e3e4dc]"
        onClick={event => event.stopPropagation()}
      >
        <header className="relative border-b border-[#343b32] px-6 pb-5 pt-7 max-[420px]:px-5">
          <div className="absolute right-[68px] top-5 grid size-10 place-items-center border border-[#4d5842] bg-[#293027] text-[#bcc899]"><FolderOpen size={20}/></div>
          <Button ref={closeButtonRef} variant="icon" className="absolute right-5 top-5" onClick={onClose} disabled={!canDismiss} aria-label={t('close')}><X size={18}/></Button>
          <p className="mb-2 text-[10px] tracking-[.14em] text-[#a0aa8a]">{t('game')}</p>
          <h2 id="game-setup-title" className="max-w-[360px] font-display text-3xl font-semibold leading-tight text-[#e6e7dd] max-[420px]:text-2xl">{t('gameSetupTitle')}</h2>
          <p className="mt-2 max-w-[420px] text-sm leading-6 text-[#b1b7ab]">{t('gameSetupIntro')}</p>
        </header>

        <div className="space-y-4 px-6 py-5 max-[420px]:px-5">
          {(loading || errorMessage) && <div className="flex min-h-11 items-center" aria-live="polite" aria-atomic="true">
            {loading ? (
              <p className="mb-0 flex items-center gap-2.5 text-sm text-[#bdc99e]"><LoaderCircle className="animate-spin motion-reduce:animate-none" size={17}/>{t('gameSetupSearching')}</p>
            ) : (
              <p className="mb-0 border border-amber-800/60 bg-amber-950/30 px-3 py-2.5 text-sm leading-relaxed text-amber-100" role="alert">{errorMessage}</p>
            )}
          </div>}
          {installations.length > 0 && <div role="radiogroup" aria-label={t('gameSetupFound')}>
            <p className="mb-2.5 text-xs font-semibold text-[#c9cebf]">{t('gameSetupFound')}</p>
            <div className="space-y-2">
            {installations.map((install, index) => {
              const active = selected?.path.toLowerCase() === install.path.toLowerCase()
              const selectedIndex = installations.findIndex(item => item.path.toLowerCase() === selected?.path.toLowerCase())
              const tabbable = selectedIndex === -1 ? index === 0 : active
              return <button
                key={install.path}
                ref={element => { radioRefs.current[index] = element }}
                type="button"
                role="radio"
                aria-checked={active}
                tabIndex={tabbable ? 0 : -1}
                className={`flex min-h-[62px] w-full items-center gap-3 border px-3 py-2.5 text-left transition-colors ${active ? 'border-[#829065] bg-[#293027]' : 'border-[#3a4237] bg-[#1b201b] hover:border-[#717d5b]'}`}
                onClick={() => onSelect(install)}
                onKeyDown={event => handleRadioKeyDown(event, index)}
              >
                <span className={`grid size-5 shrink-0 place-items-center border ${active ? 'border-[#aebc8e] bg-[#aebc8e] text-[#1c2319]' : 'border-[#596154] text-transparent'}`}>{active && <Check size={14}/>}</span>
                <span className="min-w-0 flex-1"><strong className="block text-sm font-medium text-[#e1e4d9]">{install.source}</strong><small className="mt-1 block break-all text-xs leading-relaxed text-[#aab1a4]">{install.path}</small></span>
              </button>
            })}
            </div>
          </div>}
        </div>

        <footer className="space-y-3 border-t border-[#343b32] px-6 py-4 max-[420px]:px-5">
          <div className="flex flex-wrap gap-2">
            <Button className="border-[#4c5844] bg-[#242b22] hover:bg-[#2e372b]" onClick={onRescan} disabled={loading}>
              {loading ? <LoaderCircle size={15} className="animate-spin motion-reduce:animate-none" aria-hidden="true"/> : <RefreshCw size={15}/>}
              {t(loading ? 'gameSetupSearching' : 'gameSetupRescan')}
            </Button>
            <Button className="border-[#4c5844] bg-[#242b22] hover:bg-[#2e372b]" onClick={onChooseManual}><FolderOpen size={15}/>{t('gameSetupManual')}</Button>
          </div>
          <div className="flex flex-col gap-2 min-[421px]:flex-row min-[421px]:items-center min-[421px]:justify-between">
            <Button variant="quiet" className="justify-start px-0" onClick={onClose} disabled={!canDismiss}>{t('gameSetupLater')}</Button>
            {selected && <Button variant="primary" className="min-[421px]:min-w-[190px]" onClick={() => onConfirm(selected)} disabled={loading}>{t('gameSetupUsePath')}</Button>}
          </div>
        </footer>
      </div>
    </div>
  )
}
