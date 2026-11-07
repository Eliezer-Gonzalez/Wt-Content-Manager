import { CalendarDays, FileArchive, FolderOpen, HardDriveDownload } from 'lucide-react'
import type { InstalledSkin } from '../lib/localLibrary'
import type { WtLiveItem } from '../wtLive'

type Props = { entry: InstalledSkin; locale: string; t: (key: string) => string; onOpen: (item: WtLiveItem) => void }

function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function InstalledSkinCard({ entry, locale, t, onOpen }: Props) {
  const date = entry.installedAt ? new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(new Date(entry.installedAt)) : t('unknownDate')
  return <article className="flex min-w-0 flex-col border border-[#30372f] bg-wt-panel p-4 hover:border-[#687354]">
    <div className="flex items-start gap-3">
      <span className="grid size-10 shrink-0 place-items-center border border-[#4c5742] bg-[#293027] text-[#bdc99e]"><HardDriveDownload size={18}/></span>
      <div className="min-w-0 flex-1">
        <h3 className="mb-1 line-clamp-2 font-display text-lg font-semibold leading-tight text-[#e2e4da]">{entry.item.title}</h3>
        <p className="mb-0 truncate text-xs text-[#bdc99e]">{entry.item.fileName ?? entry.folderName}</p>
      </div>
    </div>
    <dl className="mb-0 mt-4 grid grid-cols-2 gap-3 border-t border-[#333a32] pt-3 text-xs">
      <div><dt className="flex items-center gap-1.5 text-[#90998a]"><FolderOpen size={13}/>{t('installedFolder')}</dt><dd className="mb-0 mt-1 break-all text-[#c5cbbb]">{entry.folderName}</dd></div>
      <div><dt className="flex items-center gap-1.5 text-[#90998a]"><CalendarDays size={13}/>{t('installedDate')}</dt><dd className="mb-0 mt-1 text-[#c5cbbb]">{date}</dd></div>
      <div><dt className="flex items-center gap-1.5 text-[#90998a]"><FileArchive size={13}/>{t('installedFiles')}</dt><dd className="mb-0 mt-1 text-[#c5cbbb]">{entry.fileCount}</dd></div>
      <div><dt className="flex items-center gap-1.5 text-[#90998a]"><HardDriveDownload size={13}/>{t('installedSize')}</dt><dd className="mb-0 mt-1 text-[#c5cbbb]">{formatSize(entry.sizeBytes)}</dd></div>
    </dl>
    <p className="mb-3 mt-3 break-all border border-[#343b32] bg-[#1b201b] p-2 text-[11px] leading-4 text-[#9fa899]">{entry.path}</p>
    <button type="button" className="mt-auto min-h-9 text-left text-xs text-[#bdc99e] hover:text-[#e1e8cf]" onClick={() => onOpen(entry.item)}>{t('viewPost')}</button>
  </article>
}
