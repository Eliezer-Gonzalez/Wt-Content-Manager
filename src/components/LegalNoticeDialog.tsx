import { useRef } from 'react'
import { ShieldAlert, X } from 'lucide-react'
import { useI18n } from '../i18n/I18nContext'
import { useFocusTrap } from '../hooks/useFocusTrap'
import { Button } from './ui/Button'

type Props = {
  open: boolean
  required: boolean
  keepWindowControlsVisible: boolean
  onAcknowledge: () => void
  onClose: () => void
}

const noticeSections = [
  ['noticeAffiliationTitle', 'noticeAffiliation'],
  ['noticePrivacyTitle', 'noticePrivacy'],
  ['noticeRiskTitle', 'noticeRisk'],
  ['noticeDevelopmentTitle', 'noticeDevelopment'],
] as const

export function LegalNoticeDialog({ open, required, keepWindowControlsVisible, onAcknowledge, onClose }: Props) {
  const { t, locale, languages, setLocale } = useI18n()
  const dialogRef = useRef<HTMLDivElement>(null)
  const acknowledgeRef = useRef<HTMLButtonElement>(null)

  useFocusTrap({
    containerRef: dialogRef,
    initialFocusRef: acknowledgeRef,
    enabled: open,
    onClose,
    canEscape: !required,
    stopPropagationOnEscape: true,
  })

  if (!open) return null

  return (
    <div className={`fixed inset-x-0 bottom-0 z-[100] grid place-items-center overflow-y-auto bg-black/85 p-4 ${keepWindowControlsVisible ? 'top-9' : 'top-0'}`}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="independent-notice-title"
        className={`my-auto w-full max-w-[560px] overflow-y-auto border border-[#756337] bg-wt-panel text-[#e3e4dc] shadow-2xl ${keepWindowControlsVisible ? 'max-h-[calc(100dvh-4.25rem)]' : 'max-h-[calc(100dvh-2rem)]'}`}
      >
        <header className="border-b border-[#4c422b] px-6 pb-5 pt-7 max-[420px]:px-5">
          {!required && <Button variant="icon" className="float-right -mr-2 -mt-2" onClick={onClose} aria-label={t('close')}><X size={18} /></Button>}
          <div className="mb-4 grid size-11 place-items-center border border-[#806c3b] bg-[#322b1d] text-[#e5c76f]"><ShieldAlert size={22} aria-hidden="true" /></div>
          <div className="mb-2 flex items-center justify-between gap-4">
            <p className="mb-0 text-[10px] tracking-[.14em] text-[#d4b75f]">{t('noticeEyebrow')}</p>
            <label className="flex shrink-0 items-center gap-2 text-xs text-[#c4cabe]">
              <span>{t('language')}</span>
              <select
                className="border border-[#665832] bg-[#1a1f1a] px-2 py-1.5 text-xs text-[#e3e4dc] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#e3c56f]"
                value={locale}
                onChange={event => setLocale(event.target.value)}
                aria-label={t('language')}
              >
                {languages.map(language => <option key={language.code} value={language.code}>{language.name}</option>)}
              </select>
            </label>
          </div>
          <h1 id="independent-notice-title" className="font-display text-3xl font-semibold leading-tight text-[#e6e7dd] max-[420px]:text-2xl">{t('noticeTitle')}</h1>
          <p className="mb-0 mt-3 text-sm leading-6 text-[#c4cabe]">{t('noticeIntro')}</p>
        </header>
        <div className="space-y-5 px-6 py-5 max-[420px]:px-5">
          {noticeSections.map(([titleKey, bodyKey]) => (
            <section key={titleKey} className="border-l-2 border-[#8a7440] pl-3.5">
              <h2 className="mb-1 text-sm font-semibold text-[#e3c56f]">{t(titleKey)}</h2>
              <p className="mb-0 text-sm leading-6 text-[#c4cabe]">{t(bodyKey)}</p>
            </section>
          ))}
        </div>
        <footer className="border-t border-[#343b32] px-6 py-4 max-[420px]:px-5">
          <Button ref={acknowledgeRef} variant="primary" className="w-full justify-center" onClick={required ? onAcknowledge : onClose}>{t(required ? 'noticeAcknowledge' : 'close')}</Button>
        </footer>
      </div>
    </div>
  )
}
