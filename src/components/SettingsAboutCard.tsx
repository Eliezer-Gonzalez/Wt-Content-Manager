import { useState } from 'react'
import { ExternalLink, Info, ShieldAlert } from 'lucide-react'
import { openUrl } from '@tauri-apps/plugin-opener'
import { APP_LICENSE, APP_LICENSE_URL, APP_REPOSITORY_URL, APP_VERSION, THIRD_PARTY_NOTICES_URL } from '../lib/appInfo'
import { isTauriRuntime } from '../lib/gameInstall'
import { useI18n } from '../i18n/I18nProvider'
import { Button } from './ui/Button'

type Props = { onViewLegalNotice: () => void }

export function SettingsAboutCard({ onViewLegalNotice }: Props) {
  const { t } = useI18n()
  const [linkError, setLinkError] = useState(false)

  async function openExternal(url: string) {
    setLinkError(false)
    try {
      if (isTauriRuntime) await openUrl(url)
      else window.open(url, '_blank', 'noopener,noreferrer')
    } catch {
      setLinkError(true)
    }
  }

  return (
    <section className="border border-[#343b32] bg-[#1d231d]" aria-labelledby="settings-about-title">
      <div className="flex items-start gap-3 border-b border-[#343b32] px-5 py-4">
        <span className="grid size-10 shrink-0 place-items-center border border-[#4b5640] bg-[#293027] text-[#bcc899]"><Info size={19} aria-hidden="true" /></span>
        <div className="min-w-0 flex-1">
          <p className="mb-1 text-[10px] tracking-[.13em] text-[#9eaa85]">{t('settingsAboutEyebrow')}</p>
          <h2 id="settings-about-title" className="mb-0 text-base font-medium text-[#e0e3d8]">{t('settingsAboutTitle')}</h2>
        </div>
        <span className="border border-[#3b4436] bg-[#171c17] px-2 py-1 text-xs text-[#c4cabe]">v{APP_VERSION}</span>
      </div>
      <div className="space-y-4 px-5 py-4">
        <div className="grid gap-4 text-xs min-[540px]:grid-cols-2">
          <div>
            <p className="mb-1 text-[#90998c]">{t('settingsAboutAppLicense')}</p>
            <p className="mb-0 font-medium text-[#c9d0bf]">{APP_LICENSE}</p>
          </div>
          <div>
            <p className="mb-1 text-[#90998c]">{t('settingsAboutThirdParty')}</p>
            <p className="mb-0 leading-5 text-[#c9d0bf]">{t('settingsAboutThirdPartySummary')}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 border-t border-[#30372e] pt-3">
          <Button variant="secondary" size="sm" onClick={() => void openExternal(APP_REPOSITORY_URL)}><ExternalLink size={13} aria-hidden="true" />{t('settingsAboutRepository')}</Button>
          <Button variant="quiet" size="sm" onClick={() => void openExternal(APP_LICENSE_URL)}>{t('settingsAboutViewLicense')}</Button>
          <Button variant="quiet" size="sm" onClick={() => void openExternal(THIRD_PARTY_NOTICES_URL)}>{t('settingsAboutViewThirdParty')}</Button>
          <Button
            variant="quiet"
            size="sm"
            className="text-[#e5c76f] hover:bg-[#322b1d] hover:text-[#f0d98e]"
            onClick={onViewLegalNotice}
          >
            <ShieldAlert size={14} aria-hidden="true" />{t('settingsViewNotice')}
          </Button>
        </div>
        {linkError && <p className="mb-0 text-xs text-amber-200" role="alert">{t('settingsAboutLinkFailed')}</p>}
      </div>
    </section>
  )
}
