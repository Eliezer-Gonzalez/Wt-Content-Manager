import { CalendarDays, ExternalLink, FileArchive, FolderOpen, HardDriveDownload, Info, Trash2 } from 'lucide-react'
import { Button } from './ui/Button'
import type { InstalledSkin } from '../lib/localLibrary'
import type { WtLiveItem } from '../lib/wtLive'
import { formatFileSize, truncateMiddle } from '../lib/format'
import { useI18n } from '../i18n/I18nProvider'
import { AppTooltip } from './ui/AppTooltip'

type Props = {
  entry: InstalledSkin
  onOpen: (item: WtLiveItem) => void
  onUninstall: (entry: InstalledSkin) => void
}

export function InstalledSkinCard({ entry, onOpen, onUninstall }: Props) {
  const { t, locale } = useI18n()
  const installedDate = entry.installedAt ? new Date(entry.installedAt) : null
  const date = installedDate && !Number.isNaN(installedDate.getTime()) ? new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(installedDate) : t('unknownDate')
  const title = entry.item?.title || entry.folderName
  const subtitle = entry.item?.fileName || (entry.item ? entry.folderName : t('installedExternalSource'))

  return <article className="h-full flex min-w-0 flex-col border border-[#30372f] bg-wt-panel p-4 transition-colors hover:border-[#687354]">
    <div className="flex items-start gap-3">
      <span className="grid size-10 shrink-0 place-items-center border border-[#4c5742] bg-[#293027] text-[#bdc99e]"><HardDriveDownload size={18}/></span>
      <div className="min-w-0 flex-1">
        <AppTooltip content={title} className="mb-1 w-full"><div className="w-full"><h3 className="mb-0 min-h-[2.5rem] w-full line-clamp-2 font-display text-lg font-semibold leading-5 text-[#e2e4da]">{title}</h3></div></AppTooltip>
        <AppTooltip content={subtitle} className="w-full"><div className="w-full"><p className="mb-0 w-full truncate text-xs text-[#bdc99e]">{subtitle}</p></div></AppTooltip>
      </div>
    </div>
    <dl className="mb-0 mt-4 grid grid-cols-2 gap-3 border-t border-[#333a32] pt-3 text-xs">
      <AppTooltip content={entry.folderName}><div className="min-w-0"><dt className="flex items-center gap-1.5 text-[#90998a]"><FolderOpen size={13}/>{t('installedFolder')}</dt><dd className="mb-0 mt-1 truncate text-[#c5cbbb]">{entry.folderName}</dd></div></AppTooltip>
      <AppTooltip content={date}><div className="min-w-0"><dt className="flex items-center gap-1.5 text-[#90998a]"><CalendarDays size={13}/>{t(entry.item ? 'installedDate' : 'modifiedDate')}</dt><dd className="mb-0 mt-1 truncate text-[#c5cbbb]">{date}</dd></div></AppTooltip>
      <div className="min-w-0"><dt className="flex items-center gap-1.5 text-[#90998a]"><FileArchive size={13}/>{t('files')}</dt><dd className="mb-0 mt-1 truncate text-[#c5cbbb]">{t('installedFiles', { count: entry.fileCount })}</dd></div>
      <div className="min-w-0"><dt className="flex items-center gap-1.5 text-[#90998a]"><HardDriveDownload size={13}/>{t('installedSize')}</dt><dd className="mb-0 mt-1 truncate text-[#c5cbbb]">{formatFileSize(entry.sizeBytes, locale)}</dd></div>
    </dl>
    <AppTooltip content={entry.path} className="mb-3 mt-3"><p className="mb-0 w-full break-all border border-[#343b32] bg-[#1b201b] p-2 text-[11px] leading-4 text-[#9fa899]">{truncateMiddle(entry.path, 72)}</p></AppTooltip>
    <div className="mt-auto flex items-center gap-2 pt-1">
      {entry.item ? (
        <Button variant="secondary" size="sm" className="flex-1 justify-center" onClick={() => onOpen(entry.item!)} aria-label={t('viewPostAria', { title })}>
          <span>{t('viewPost')}</span>
          <ExternalLink size={13} aria-hidden="true" />
        </Button>
      ) : (
        <span className="inline-flex min-h-8 flex-1 items-center justify-center gap-2 border border-[#394136] bg-[#20261f] px-2.5 py-1 text-xs text-[#9fa896]">
          {t('installedExternalBadge')}
          <AppTooltip content={t('externalSkinInfo')}>
            <span className="rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-olive" tabIndex={0} aria-label={t('externalSkinInfo')}>
              <Info size={14} aria-hidden="true" />
            </span>
          </AppTooltip>
        </span>
      )}
      <AppTooltip content={t('uninstallSkin')} align="end">
        <Button variant="danger" size="sm" onClick={() => onUninstall(entry)} aria-label={t('uninstallSkinAria', { name: title })}>
          <Trash2 size={14} aria-hidden="true" />
        </Button>
      </AppTooltip>
    </div>
  </article>
}

