import { Check, Download, HardDrive } from 'lucide-react'
import { Button } from './ui/Button'
import { useI18n } from '../i18n/I18nProvider'
import { formatFileSize } from '../lib/format'
import type { SoundModStatus, SoundPackage } from '../lib/sounds'

type Props = {
  packageInfo: SoundPackage
  status: SoundModStatus | null
  gameReady: boolean
  busy: boolean
  onInstall: (packageInfo: SoundPackage) => void
}

export function SoundPackageCard({ packageInfo, status, gameReady, busy, onInstall }: Props) {
  const { t, locale } = useI18n()
  const active = status?.activePackageId === packageInfo.id

  return (
    <article className="flex min-w-0 flex-col border border-[#30372f] bg-wt-panel p-3">
      <div className="flex items-start justify-between gap-2">
        <h3 className="m-0 line-clamp-2 break-words font-display text-lg font-semibold leading-tight text-[#e2e4da]">{packageInfo.title || packageInfo.archiveName}</h3>
        {active && <span className="flex shrink-0 items-center gap-1 border border-[#6f8252] bg-[#1e271b] px-2 py-1 text-[10px] font-bold tracking-[.08em] text-[#b4d882]"><Check size={11} />{t('soundActive')}</span>}
      </div>
      <p className="mb-0 mt-1 truncate text-xs text-[#bdc99e]">{t('by')} {packageInfo.author || t('unknownAuthor')}</p>
      <p className="mb-3 mt-2 flex items-center gap-1.5 border-t border-[#333a32] pt-2 text-[11px] text-[#a2aa9c]">
        <HardDrive size={13} aria-hidden="true" />
        <span className="min-w-0 truncate">{packageInfo.archiveName}</span>
        <span className="ml-auto shrink-0">{formatFileSize(packageInfo.sizeBytes, locale)}</span>
      </p>
      <Button
        variant={active ? 'secondary' : 'primary'}
        size="sm"
        className="mt-auto w-full"
        disabled={!gameReady || busy || active}
        onClick={() => onInstall(packageInfo)}
      >
        <Download size={14} aria-hidden="true" />{t(active ? 'soundActive' : 'soundInstallPackage')}
      </Button>
    </article>
  )
}
