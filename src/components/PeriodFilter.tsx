import { useEffect, useRef, useState } from 'react'
import { Check, ChevronDown, SlidersHorizontal } from 'lucide-react'
import { useI18n, type TranslationKey } from '../i18n/I18nProvider'

export type Period = 0 | 7 | 90 | 180
type Props = { value: Period; onChange: (period: Period) => void }
const options: Array<{ value: Period; label: TranslationKey }> = [
  { value: 7, label: 'periodWeek' },
  { value: 90, label: 'periodThreeMonths' },
  { value: 180, label: 'periodSixMonths' },
  { value: 0, label: 'periodAll' },
]

export function PeriodFilter({ value, onChange }: Props) {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([])
  const selectedIndex = options.findIndex(option => option.value === value)

  useEffect(() => {
    if (!open) return
    const closeOnOutside = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', closeOnOutside)
    return () => document.removeEventListener('pointerdown', closeOnOutside)
  }, [open])

  function moveFocus(index: number) {
    const next = (index + options.length) % options.length
    optionRefs.current[next]?.focus()
  }

  return <div className="relative shrink-0" ref={rootRef}>
    <button
      ref={triggerRef}
      type="button"
      aria-label={t('filters')}
      aria-haspopup="menu"
      aria-expanded={open}
      onClick={() => setOpen(current => !current)}
      onKeyDown={event => {
        if (event.key === 'Escape' && open) {
          event.preventDefault()
          setOpen(false)
        }
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
          event.preventDefault()
          setOpen(true)
          requestAnimationFrame(() => moveFocus(selectedIndex + (event.key === 'ArrowDown' ? 1 : -1)))
        }
      }}
      className="flex h-11 min-w-[205px] items-center gap-2 border border-[#41483d] bg-wt-panel px-3 text-sm text-[#e1e4d9] transition-colors hover:border-[#717d5b] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-olive max-[520px]:min-w-0 max-[520px]:px-2"
    >
      <SlidersHorizontal size={16} className="shrink-0 text-[#aeb990]" aria-hidden="true" />
      <span className="flex-1 text-left">{t(options[selectedIndex]?.label ?? 'periodWeek')}</span>
      <ChevronDown size={15} className={`shrink-0 text-[#a0aa9b] transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
    </button>
    {open && <div
      role="menu"
      aria-label={t('filters')}
      className="absolute right-0 top-[calc(100%+6px)] z-40 min-w-full overflow-hidden border border-[#48523f] bg-[#20261f] p-1 shadow-xl shadow-black/40"
      onKeyDown={event => {
        const current = optionRefs.current.indexOf(document.activeElement as HTMLButtonElement)
        if (event.key === 'ArrowDown') { event.preventDefault(); moveFocus(current + 1) }
        if (event.key === 'ArrowUp') { event.preventDefault(); moveFocus(current - 1) }
        if (event.key === 'Home') { event.preventDefault(); moveFocus(0) }
        if (event.key === 'End') { event.preventDefault(); moveFocus(options.length - 1) }
        if (event.key === 'Escape') { event.preventDefault(); setOpen(false); triggerRef.current?.focus() }
      }}
    >
      {options.map((option, index) => {
        const selected = option.value === value
        return <button
          key={option.value}
          ref={element => { optionRefs.current[index] = element }}
          type="button"
          role="menuitemradio"
          aria-checked={selected}
          tabIndex={selected ? 0 : -1}
          onClick={() => { onChange(option.value); setOpen(false); triggerRef.current?.focus() }}
          className={`flex min-h-10 w-full items-center gap-2 px-2.5 text-left text-sm transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-olive ${selected ? 'bg-[#35402f] text-[#e5ebd8]' : 'text-[#c1c8b8] hover:bg-[#2c3429] hover:text-[#eef0e8]'}`}
        >
          <span className="flex-1 whitespace-nowrap">{t(option.label)}</span>
          {selected && <Check size={15} className="text-[#b9c995]" aria-hidden="true" />}
        </button>
      })}
    </div>}
  </div>
}
