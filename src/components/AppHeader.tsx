import { Activity } from 'lucide-react'
import { useI18n } from '../i18n/I18nContext'
import { asTranslationKey } from '../i18n/translationKey'
import type { AppSection } from './NavigationSidebar'

type Props = { active: AppSection }

export function AppHeader({ active }: Props) {
  const { t, locale, languages, setLocale } = useI18n()

  return (
    <header className="flex h-[59px] shrink-0 items-center justify-between border-b border-[#2c332c] px-[42px] max-[1100px]:px-[26px] max-[720px]:h-12 max-[720px]:px-[17px]">
      <div className="text-[10px] tracking-[.13em] text-[#a0a99c]">
        {t('sourceName')} <span className="px-2 text-[#717b6e]">/</span>
        <b className="font-medium text-[#d3d7ca]">{t(asTranslationKey(active)).toUpperCase()}</b>
      </div>
      <div className="flex items-center gap-3 min-[721px]:gap-5">
        <span className="flex items-center gap-1.5 text-xs text-[#a1a99b] max-[520px]:hidden"><Activity size={14} />{t('catalog')}</span>
        <label className="flex items-center gap-1.5 text-xs text-[#a1a99b]">
          <span className="sr-only min-[521px]:not-sr-only">{t('language')}</span>
          <select className="border border-[#343b32] bg-wt-panel px-2 py-1.5 text-xs text-[#d3d7ca] focus-visible:outline-2 focus-visible:outline-olive" value={locale} onChange={event => setLocale(event.target.value)} aria-label={t('language')}>
            {languages.map(language => <option key={language.code} value={language.code}>{language.name}</option>)}
          </select>
        </label>
      </div>
    </header>
  )
}
