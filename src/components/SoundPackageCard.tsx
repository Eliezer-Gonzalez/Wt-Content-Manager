import { CalendarDays, Check, Download, ExternalLink, FileArchive, FolderOpen, HardDriveDownload, LoaderCircle, Trash2, Volume2 } from 'lucide-react'
import { Button } from './ui/Button'
import { AppTooltip } from './ui/AppTooltip'
import { useI18n } from '../i18n/I18nProvider'
import { formatFileSize, truncateMiddle } from '../lib/format'
import type { SoundModStatus, SoundPackage } from '../lib/sounds'
import type { WtLiveItem } from '../lib/wtLive'
import type { SoundPackageUpdateResult } from '../hooks/useSoundPackageUpdates'

type Props = {
  packageInfo: SoundPackage
  status: SoundModStatus | null
  updateStatus?: SoundPackageUpdateResult
  gameReady: boolean
  checkingStatus: boolean
  busy: boolean
  onInstall: (packageInfo: SoundPackage) => void
  onUninstall: () => void
  onOpenPost: (item: WtLiveItem) => void
}

export function SoundPackageCard({ packageInfo, status, updateStatus, gameReady, checkingStatus, busy, onInstall, onUninstall, onOpenPost }: Props) {
  const { t, locale } = useI18n()
  const active = status?.activePackageId === packageInfo.id
  const date = new Date(packageInfo.downloadedAt)
  const downloadedDate = Number.isNaN(date.getTime())
    ? t('unknownDate')
    : new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(date)
  const packageFolder = 'sounds/packages/' + packageInfo.id
  const publication: WtLiveItem = {
    contentType: 'sound',
    id: packageInfo.langGroup,
    langGroup: packageInfo.langGroup,
    language: 'en',
    title: packageInfo.title || packageInfo.archiveName,
    description: '',
    author: packageInfo.author,
    createdAt: packageInfo.downloadedAt,
    fileName: packageInfo.archiveName,
    likes: 0,
    downloads: 0,
  }

  return (
    <article className={`h-full flex min-w-0 flex-col border bg-wt-panel p-4 transition-colors ${active ? 'border-[#91ad5f] shadow-[0_0_0_1px_rgba(177,216,130,0.24)]' : 'border-[#30372f] hover:border-[#687354]'}`}>
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center border border-[#4c5742] bg-[#293027] text-[#bdc99e]"><Volume2 size={18} aria-hidden="true" /></span>
        <div className="min-w-0 flex-1">
          <div className="flex min-h-[2.5rem] items-start gap-2">
            <h3 className="m-0 min-w-0 flex-1 line-clamp-2 break-words font-display text-lg font-semibold leading-5 text-[#e2e4da]">{packageInfo.title || packageInfo.archiveName}</h3>
            {active && (
              <span className="flex shrink-0 items-center gap-1 border border-[#6f8252] bg-[#1e271b] px-2 py-1 text-[10px] font-bold tracking-[.08em] text-[#b4d882]">
                <Check size={11} aria-hidden="true" />{t('soundActive')}
              </span>
            )}
          </div>
          <p className="mb-0 mt-1 truncate text-xs text-[#bdc99e]">{t('by')} {packageInfo.author || t('unknownAuthor')}</p>
        </div>
      </div>

      <AppTooltip content={packageInfo.archiveName} className="mt-3 w-full">
        <p className="mb-0 flex min-w-0 items-center gap-1.5 truncate text-xs text-[#a2aa9c]">
          <FileArchive size={13} className="shrink-0" aria-hidden="true" />{packageInfo.archiveName}
        </p>
      </AppTooltip>
      {updateStatus?.status === 'possible' && (
        <p className="mb-0 mt-2 border border-[#766638] bg-[#302b1d] px-2.5 py-2 text-xs leading-5 text-[#dfd5b6]">
          <strong className="font-semibold text-[#f1e6c5]">{t('soundUpdatePossible')}</strong>
          {updateStatus.remoteArchiveName && <span className="block break-all text-[11px]">{t('soundUpdateRemoteFile', { file: updateStatus.remoteArchiveName })}</span>}
        </p>
      )}
      {updateStatus?.status === 'unavailable' && (
        <p className="mb-0 mt-2 text-xs text-[#c1aa7a]">{t('soundUpdateUnavailable')}</p>
      )}

      <dl className="mb-0 mt-4 grid grid-cols-2 gap-3 border-t border-[#333a32] pt-3 text-xs">
        <div className="min-w-0">
          <dt className="flex items-center gap-1.5 text-[#90998a]"><FolderOpen size={13} aria-hidden="true" />{t('soundPackageFolder')}</dt>
          <dd className="mb-0 mt-1 truncate text-[#c5cbbb]">{packageInfo.id}</dd>
        </div>
        <div className="min-w-0">
          <dt className="flex items-center gap-1.5 text-[#90998a]"><CalendarDays size={13} aria-hidden="true" />{t('soundDownloadedOn')}</dt>
          <dd className="mb-0 mt-1 truncate text-[#c5cbbb]">{downloadedDate}</dd>
        </div>
        <div className="min-w-0">
          <dt className="flex items-center gap-1.5 text-[#90998a]"><FileArchive size={13} aria-hidden="true" />{t('files')}</dt>
          <dd className="mb-0 mt-1 truncate text-[#c5cbbb]">{packageInfo.fileCount == null ? t('soundFileCountUnavailable') : t('installedFiles', { count: packageInfo.fileCount })}</dd>
        </div>
        <div className="min-w-0">
          <dt className="flex items-center gap-1.5 text-[#90998a]"><HardDriveDownload size={13} aria-hidden="true" />{t('installedSize')}</dt>
          <dd className="mb-0 mt-1 truncate text-[#c5cbbb]">{formatFileSize(packageInfo.sizeBytes, locale)}</dd>
        </div>
      </dl>

      <AppTooltip content={packageFolder} className="mb-3 mt-3">
        <p className="mb-0 w-full break-all border border-[#343b32] bg-[#1b201b] p-2 text-[11px] leading-4 text-[#9fa899]">{truncateMiddle(packageFolder, 72)}</p>
      </AppTooltip>
      <div className="mt-auto flex gap-2 pt-1">
        <Button
          variant="secondary"
          size="sm"
          className="min-w-0 flex-1 justify-center"
          onClick={() => onOpenPost(publication)}
          aria-label={t('viewPostAria', { title: publication.title })}
        >
          <span>{t('viewPost')}</span><ExternalLink size={13} aria-hidden="true" />
        </Button>
        <Button
          variant={active ? 'secondary' : 'primary'}
          size="sm"
          className="min-w-0 flex-1 justify-center"
          disabled={!gameReady || checkingStatus || busy}
          onClick={() => active ? onUninstall() : onInstall(packageInfo)}
        >
          {checkingStatus
            ? <LoaderCircle size={14} className="animate-spin motion-reduce:animate-none" aria-hidden="true" />
            : active ? <Trash2 size={14} aria-hidden="true" /> : <Download size={14} aria-hidden="true" />}
          {t(checkingStatus ? 'checkingSoundStatus' : active ? 'soundUninstall' : 'soundInstallPackage')}
        </Button>
      </div>
    </article>
  )
}
