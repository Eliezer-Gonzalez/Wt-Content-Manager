import type { ComponentProps, RefObject } from 'react'
import { useMemo, useState } from 'react'
import { ChevronDown, FolderOpen, LoaderCircle, RefreshCw, Search } from 'lucide-react'
import { Button } from './ui/Button'
import { EmptyLibraryState } from './EmptyLibraryState'
import { InstalledSkinCard } from './InstalledSkinCard'
import { PaginatedGrid } from './PaginatedGrid'
import { SectionHeader } from './HeroBanner'
import { DownloadsLibraryControls, DownloadsLibrarySummary, SoundDownloadsLibraryControls } from './DownloadsLibraryControls'
import { SoundDownloadsSection } from './SoundDownloadsSection'
import { SoundUpdateControls } from './SoundUpdateControls'
import type { SoundPackageUpdateController } from '../hooks/useSoundPackageUpdates'
import type { WtLiveItem } from '../lib/wtLive'
import { useI18n } from '../i18n/I18nContext'
import { openUserSkinsFolder } from '../lib/settings'
import { filterAndSortInstalledSkins, filterAndSortSoundPackages, type DownloadOriginFilter, type DownloadSortOrder, type SoundDownloadStatusFilter } from '../lib/downloadLibrary'
import type { InstalledSkin } from '../lib/localLibrary'
import type { SoundLibraryController } from '../hooks/useSoundLibrary'

type DownloadCategory = 'camouflages' | 'sounds'

type CamouflageDownloads = {
  entries: InstalledSkin[]
  query: string
  onQueryChange: (value: string) => void
  origin: DownloadOriginFilter
  onOriginChange: (value: DownloadOriginFilter) => void
  sort: DownloadSortOrder
  onSortChange: (value: DownloadSortOrder) => void
  gamePath?: string
  scanning: boolean
  onRescan: () => void
  onOpenPost: ComponentProps<typeof InstalledSkinCard>['onOpen']
  onUninstall: ComponentProps<typeof InstalledSkinCard>['onUninstall']
}

type SoundDownloads = {
  library: SoundLibraryController
  query: string
  onQueryChange: (value: string) => void
  statusFilter: SoundDownloadStatusFilter
  onStatusFilterChange: (value: SoundDownloadStatusFilter) => void
  sort: DownloadSortOrder
  onSortChange: (value: DownloadSortOrder) => void
  gamePath?: string
  onChooseGame: () => void
  onExploreSounds: () => void
  onOpenPost: (item: WtLiveItem) => void
  updates: SoundPackageUpdateController
}

type Props = {
  category: DownloadCategory
  onCategoryChange: (category: DownloadCategory) => void
  camouflages: CamouflageDownloads
  sounds: SoundDownloads
  searchInputRef: RefObject<HTMLInputElement | null>
  onExploreCamouflages: () => void
}

const isApple = typeof navigator !== 'undefined' && /(Mac|iPhone|iPod|iPad)/i.test(navigator.userAgent || navigator.platform || '')

export function DownloadsPage({ category, onCategoryChange, camouflages, sounds, searchInputRef, onExploreCamouflages }: Props) {
  const { t } = useI18n()
  const [openingUserSkins, setOpeningUserSkins] = useState(false)
  const [userSkinsError, setUserSkinsError] = useState(false)
  const visibleSkins = useMemo(
    () => filterAndSortInstalledSkins(camouflages.entries, camouflages.query, camouflages.origin, camouflages.sort),
    [camouflages.entries, camouflages.query, camouflages.origin, camouflages.sort],
  )
  const totalSkinBytes = useMemo(
    () => camouflages.entries.reduce((total, entry) => total + entry.sizeBytes, 0),
    [camouflages.entries],
  )
  const soundStatusAvailable = Boolean(sounds.library.status && !sounds.library.statusLoading)
  const effectiveSoundFilter = soundStatusAvailable ? sounds.statusFilter : 'all'
  const visibleSoundPackages = useMemo(
    () => filterAndSortSoundPackages(
      sounds.library.packages,
      sounds.query,
      effectiveSoundFilter,
      sounds.sort,
      sounds.library.status?.activePackageId ?? null,
    ),
    [sounds.library.packages, sounds.library.status?.activePackageId, sounds.query, effectiveSoundFilter, sounds.sort],
  )

  const query = category === 'camouflages' ? camouflages.query : sounds.query
  const placeholder = t(category === 'camouflages' ? 'searchPlaceholder' : 'soundDownloadsSearchPlaceholder')

  async function handleOpenUserSkins() {
    if (!camouflages.gamePath || openingUserSkins) return
    setOpeningUserSkins(true)
    setUserSkinsError(false)
    try {
      await openUserSkinsFolder(camouflages.gamePath)
    } catch {
      setUserSkinsError(true)
    } finally {
      setOpeningUserSkins(false)
    }
  }

  return (
    <div className="flex w-full flex-1 flex-col px-8 pb-5 pt-8 max-[1100px]:px-6 max-[720px]:px-4 max-[720px]:pt-6">
      <SectionHeader variant="downloads" size="compact" eyebrow={t('libraryLocal')} titleHighlight={t('downloads')} />

      <div className="mb-5 mt-4 flex flex-wrap gap-2 border-b border-[#343b32]" role="group" aria-label={t('downloadsCategories')}>
        <button
          id="downloads-tab-camouflages"
          type="button"
          aria-pressed={category === 'camouflages'}
          onClick={() => onCategoryChange('camouflages')}
          className={`flex min-h-11 items-center gap-2 border-b-2 px-3 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-olive ${category === 'camouflages' ? 'border-olive bg-[#252c23] text-[#e3e8d7]' : 'border-transparent text-[#aab2a4] hover:bg-[#222820] hover:text-[#e3e8d7]'}`}
        >
          <span>{t('camouflages')}</span>
          <span className="text-xs text-[#aeb990]">{camouflages.entries.length}</span>
        </button>
        <button
          id="downloads-tab-sounds"
          type="button"
          aria-pressed={category === 'sounds'}
          onClick={() => onCategoryChange('sounds')}
          className={`flex min-h-11 items-center gap-2 border-b-2 px-3 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-olive ${category === 'sounds' ? 'border-olive bg-[#252c23] text-[#e3e8d7]' : 'border-transparent text-[#aab2a4] hover:bg-[#222820] hover:text-[#e3e8d7]'}`}
        >
          <span>{t('sounds')}</span>
          <span className="text-xs text-[#aeb990]">{sounds.library.packages.length}</span>
        </button>
      </div>

      <section className="mb-3 flex flex-wrap items-center gap-2.5" aria-label={t('downloadsControls')}>
        <label className="flex h-11 min-w-[240px] max-w-[490px] flex-1 items-center gap-2.5 border border-[#343b32] bg-wt-panel px-3 text-[#a0aa9b] focus-within:border-[#717d5b]">
          <Search size={17} aria-hidden="true" />
          <input
            ref={searchInputRef}
            className="min-w-0 flex-1 bg-transparent text-sm text-[#e2e5db] outline-none placeholder:text-[#929a8e]"
            value={query}
            onChange={event => category === 'camouflages' ? camouflages.onQueryChange(event.target.value) : sounds.onQueryChange(event.target.value)}
            placeholder={placeholder}
            aria-label={t(category === 'camouflages' ? 'downloadsSearchLabel' : 'soundDownloadsSearchLabel')}
          />
          <kbd className="border border-[#41483d] px-1.5 py-0.5 text-[10px] text-[#929a8e] max-[720px]:hidden">{isApple ? '⌘ K' : 'Ctrl K'}</kbd>
        </label>
        {category === 'camouflages' ? (
          <DownloadsLibraryControls
            origin={camouflages.origin}
            sort={camouflages.sort}
            onOriginChange={camouflages.onOriginChange}
            onSortChange={camouflages.onSortChange}
          />
        ) : (
          <SoundDownloadsLibraryControls
            statusFilter={effectiveSoundFilter}
            statusAvailable={soundStatusAvailable}
            sort={sounds.sort}
            onStatusFilterChange={sounds.onStatusFilterChange}
            onSortChange={sounds.onSortChange}
          />
        )}
      </section>

      <section aria-label={t(category === 'camouflages' ? 'camouflages' : 'sounds')}>
        {category === 'camouflages' ? (
          <>
            <div className="mb-4 mt-1 flex flex-wrap items-center justify-between gap-3">
              <DownloadsLibrarySummary totalCount={camouflages.entries.length} totalSizeBytes={totalSkinBytes} kind="camouflages" />
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-[#9fa89b]">{t('downloadsFilteredCount', { count: visibleSkins.length })}</span>
                {camouflages.gamePath && (
                  <>
                    <Button variant="secondary" size="sm" className="min-h-10" onClick={camouflages.onRescan} disabled={camouflages.scanning}>
                      <RefreshCw size={13} className={camouflages.scanning ? 'animate-spin motion-reduce:animate-none' : ''} aria-hidden="true" />
                      <span>{t(camouflages.scanning ? 'scanningSkins' : 'rescanSkins')}</span>
                    </Button>
                    <Button variant="secondary" size="sm" className="min-h-10" onClick={() => void handleOpenUserSkins()} disabled={openingUserSkins}>
                      {openingUserSkins ? <LoaderCircle size={13} className="animate-spin motion-reduce:animate-none" aria-hidden="true" /> : <FolderOpen size={13} aria-hidden="true" />}
                      <span>{t(openingUserSkins ? 'downloadsOpenUserSkinsWorking' : 'downloadsOpenUserSkins')}</span>
                    </Button>
                  </>
                )}
              </div>
            </div>
            {userSkinsError && <p className="mb-3 text-xs text-amber-200" role="alert">{t('downloadsOpenUserSkinsFailed')}</p>}
            {visibleSkins.length === 0 ? (
              camouflages.entries.length > 0 ? (
                <div className="grid min-h-40 place-items-center text-center text-sm text-[#b1b7ab]">{t('noMatchingDownloads')}</div>
              ) : (
                <EmptyLibraryState kind="downloads" onExplore={onExploreCamouflages} />
              )
            ) : (
              <PaginatedGrid
                items={visibleSkins}
                resetKey={`downloads-camouflages-${camouflages.query}-${camouflages.origin}-${camouflages.sort}`}
                getKey={entry => entry.path}
                gridClassName="grid grid-cols-2 gap-3 min-[1100px]:grid-cols-3 min-[1600px]:grid-cols-4 min-[2300px]:grid-cols-5 max-[720px]:grid-cols-1"
                renderItem={entry => <InstalledSkinCard entry={entry} showPreview onOpen={camouflages.onOpenPost} onUninstall={camouflages.onUninstall} />}
              />
            )}
          </>
        ) : (
          <>
          <SoundUpdateControls updates={sounds.updates} packages={sounds.library.packages} />
          <SoundDownloadsSection
            gamePath={sounds.gamePath}
            library={sounds.library}
            packages={visibleSoundPackages}
            updateResults={sounds.updates.results}
            hasPackages={sounds.library.packages.length > 0}
            onChooseGame={sounds.onChooseGame}
            onExploreSounds={sounds.onExploreSounds}
            onOpenPost={sounds.onOpenPost}
          />
          </>
        )}
      </section>
    </div>
  )
}
