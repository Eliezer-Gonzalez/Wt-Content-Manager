import { CalendarDays, ExternalLink, FileArchive, FolderOpen, HardDriveDownload, Trash2 } from 'lucide-react'
import { Button } from './ui/Button'
import type { InstalledSkin } from '../lib/localLibrary'
import type { WtLiveItem } from '../lib/wtLive'
import { formatFileSize } from '../lib/format'
import { useI18n } from '../i18n/I18nProvider'

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
        <h3 className="mb-1 min-h-[2.5rem] line-clamp-2 font-display text-lg font-semibold leading-5 text-[#e2e4da]" title={title}>{title}</h3>
        <p className="mb-0 truncate text-xs text-[#bdc99e]" title={subtitle}>{subtitle}</p>
      </div>
    </div>
    <dl className="mb-0 mt-4 grid grid-cols-2 gap-3 border-t border-[#333a32] pt-3 text-xs">
      <div className="min-w-0"><dt className="flex items-center gap-1.5 text-[#90998a]"><FolderOpen size={13}/>{t('installedFolder')}</dt><dd className="mb-0 mt-1 truncate text-[#c5cbbb]" title={entry.folderName}>{entry.folderName}</dd></div>
      <div className="min-w-0"><dt className="flex items-center gap-1.5 text-[#90998a]"><CalendarDays size={13}/>{t(entry.item ? 'installedDate' : 'modifiedDate')}</dt><dd className="mb-0 mt-1 truncate text-[#c5cbbb]" title={date}>{date}</dd></div>
      <div className="min-w-0"><dt className="flex items-center gap-1.5 text-[#90998a]"><FileArchive size={13}/>{t('files')}</dt><dd className="mb-0 mt-1 truncate text-[#c5cbbb]">{t('installedFiles', { count: entry.fileCount })}</dd></div>
      <div className="min-w-0"><dt className="flex items-center gap-1.5 text-[#90998a]"><HardDriveDownload size={13}/>{t('installedSize')}</dt><dd className="mb-0 mt-1 truncate text-[#c5cbbb]">{formatFileSize(entry.sizeBytes, locale)}</dd></div>
    </dl>
    <p className="mb-3 mt-3 truncate border border-[#343b32] bg-[#1b201b] p-2 text-[11px] leading-4 text-[#9fa899]" title={entry.path}>{entry.path}</p>
    <div className="mt-auto flex items-center gap-2 pt-1">
      {entry.item ? (
        <Button variant="secondary" size="sm" className="flex-1 justify-center" onClick={() => onOpen(entry.item!)} aria-label={t('viewPostAria', { title })}>
          <span>{t('viewPost')}</span>
          <ExternalLink size={13} aria-hidden="true" />
        </Button>
      ) : (
        <span className="inline-flex min-h-8 flex-1 items-center justify-center border border-[#394136] bg-[#20261f] px-2.5 py-1 text-xs text-[#9fa896]">
          {t('installedExternalBadge')}
        </span>
      )}
      <Button variant="danger" size="sm" onClick={() => onUninstall(entry)} aria-label={t('uninstallSkinAria', { name: title })} title={t('uninstallSkin')}>
        <Trash2 size={14} aria-hidden="true" />
      </Button>
    </div>
  </article>
}

