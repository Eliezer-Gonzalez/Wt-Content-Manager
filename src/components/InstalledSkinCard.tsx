import { CalendarDays, ExternalLink, FileArchive, FolderOpen, HardDriveDownload } from 'lucide-react'
import { Button } from './ui/Button'
import type { InstalledSkin } from '../lib/localLibrary'
import type { WtLiveItem } from '../wtLive'
import { formatFileSize } from '../lib/format'
import type { TranslationKey, TranslationParams } from '../i18n/I18nProvider'

type Props = {
  entry: InstalledSkin
  locale: string
  t: (key: TranslationKey, params?: TranslationParams) => string
  onOpen: (item: WtLiveItem) => void
}

export function InstalledSkinCard({ entry, locale, t, onOpen }: Props) {
  const date = entry.installedAt ? new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(new Date(entry.installedAt)) : t('unknownDate')
  const title = entry.item.title || t('postFallbackTitle', { id: entry.item.id })

  return <article className="flex min-w-0 flex-col border border-[#30372f] bg-wt-panel p-4 hover:border-[#687354]">
    <div className="flex items-start gap-3">
      <span className="grid size-10 shrink-0 place-items-center border border-[#4c5742] bg-[#293027] text-[#bdc99e]"><HardDriveDownload size={18}/></span>
      <div className="min-w-0 flex-1">
        <h3 className="mb-1 line-clamp-2 font-display text-lg font-semibold leading-tight text-[#e2e4da]">{title}</h3>
        <p className="mb-0 truncate text-xs text-[#bdc99e]">{entry.item.fileName ?? entry.folderName}</p>
      </div>
    </div>
    <dl className="mb-0 mt-4 grid grid-cols-2 gap-3 border-t border-[#333a32] pt-3 text-xs">
      <div><dt className="flex items-center gap-1.5 text-[#90998a]"><FolderOpen size={13}/>{t('installedFolder')}</dt><dd className="mb-0 mt-1 break-all text-[#c5cbbb]">{entry.folderName}</dd></div>
      <div><dt className="flex items-center gap-1.5 text-[#90998a]"><CalendarDays size={13}/>{t('installedDate')}</dt><dd className="mb-0 mt-1 text-[#c5cbbb]">{date}</dd></div>
      <div><dt className="flex items-center gap-1.5 text-[#90998a]"><FileArchive size={13}/>{t('files')}</dt><dd className="mb-0 mt-1 text-[#c5cbbb]">{t('installedFiles', { count: entry.fileCount })}</dd></div>
      <div><dt className="flex items-center gap-1.5 text-[#90998a]"><HardDriveDownload size={13}/>{t('installedSize')}</dt><dd className="mb-0 mt-1 text-[#c5cbbb]">{formatFileSize(entry.sizeBytes, locale)}</dd></div>
    </dl>
    <p className="mb-3 mt-3 break-all border border-[#343b32] bg-[#1b201b] p-2 text-[11px] leading-4 text-[#9fa899]">{entry.path}</p>
    <Button variant="secondary" size="sm" className="mt-auto w-full justify-center" onClick={() => onOpen(entry.item)} aria-label={t('viewPostAria', { title })}>
      <span>{t('viewPost')}</span>
      <ExternalLink size={13} aria-hidden="true" />
    </Button>
  </article>
}
