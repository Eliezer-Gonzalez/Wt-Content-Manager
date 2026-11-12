import { APP_VERSION } from '../lib/appInfo'
import { useI18n } from '../i18n/I18nContext'

export function AppFooter() {
  const { t } = useI18n()
  return (
    <footer className="sticky bottom-0 z-20 mx-8 mt-auto flex shrink-0 flex-wrap justify-between gap-x-3 gap-y-1 border-t border-[#2d342d] bg-wt-bg px-1 py-3 text-[10px] tracking-[.06em] text-[#8d968a] max-[1100px]:mx-6 max-[720px]:mx-4">
      <span>{t('dataSource')}</span>
      <span>By DestGM · {t('brandManager')} <b className="font-medium text-[#b2baa9]">{APP_VERSION}</b></span>
    </footer>
  )
}
