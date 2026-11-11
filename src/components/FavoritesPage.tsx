import { useMemo, type RefObject } from 'react'
import { ChevronDown, Search } from 'lucide-react'
import { Button } from './ui/Button'
import { EmptyLibraryState } from './EmptyLibraryState'
import { MasonryPostGrid } from './MasonryPostGrid'
import { PostCard } from './PostCard'
import { SectionHeader } from './HeroBanner'
import { PaginatedGrid } from './PaginatedGrid'
import { useI18n } from '../i18n/I18nProvider'
import type { WtLiveItem } from '../lib/wtLive'

export type FavoriteCategory = 'camouflages' | 'sounds'
export type FavoriteSort = 'recent' | 'popular'

type Props = {
  favorites: WtLiveItem[]
  category: FavoriteCategory
  onCategoryChange: (category: FavoriteCategory) => void
  camouflageQuery: string
  onCamouflageQueryChange: (value: string) => void
  soundQuery: string
  onSoundQueryChange: (value: string) => void
  camouflageSort: FavoriteSort
  onCamouflageSortChange: (sort: FavoriteSort) => void
  soundSort: FavoriteSort
  onSoundSortChange: (sort: FavoriteSort) => void
  searchInputRef: RefObject<HTMLInputElement | null>
  onOpen: (item: WtLiveItem) => void
  onRemove: (item: WtLiveItem) => void
  isInstalled: (item: WtLiveItem) => boolean
  isDownloaded: (item: WtLiveItem) => boolean
  onExplore: (category: FavoriteCategory) => void
}

export function FavoritesPage({
  favorites, category, onCategoryChange, camouflageQuery, onCamouflageQueryChange, soundQuery,
  onSoundQueryChange, camouflageSort, onCamouflageSortChange, soundSort, onSoundSortChange,
  searchInputRef, onOpen, onRemove, isInstalled, isDownloaded, onExplore,
}: Props) {
  const { t } = useI18n()
  const sounds = favorites.filter(item => item.contentType === 'sound')
  const camouflages = favorites.filter(item => item.contentType !== 'sound')
  const selectedItems = category === 'sounds' ? sounds : camouflages
  const query = category === 'sounds' ? soundQuery : camouflageQuery
  const sort = category === 'sounds' ? soundSort : camouflageSort
  const visibleItems = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    const filtered = selectedItems.filter(item => !normalizedQuery ||
      `${item.title} ${item.author} ${item.fileName ?? ''} ${item.description}`.toLowerCase().includes(normalizedQuery))
    return sort === 'popular'
      ? [...filtered].sort((left, right) => right.likes - left.likes)
      : [...filtered].sort((left, right) => right.createdAt - left.createdAt)
  }, [query, selectedItems, sort])

  return (
    <div className="flex w-full flex-1 flex-col px-8 pb-5 pt-8 max-[1100px]:px-6 max-[720px]:px-4 max-[720px]:pt-6">
      <SectionHeader variant="favorites" size="compact" eyebrow={t('libraryLocal')} titleHighlight={t('favorites')} />

      <div className="mb-5 mt-4 flex flex-wrap gap-2 border-b border-[#343b32]" role="group" aria-label={t('favoritesCategories')}>
        <button
          type="button"
          aria-pressed={category === 'camouflages'}
          onClick={() => onCategoryChange('camouflages')}
          className={`flex min-h-11 items-center gap-2 border-b-2 px-3 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-olive ${category === 'camouflages' ? 'border-olive bg-[#252c23] text-[#e3e8d7]' : 'border-transparent text-[#aab2a4] hover:bg-[#222820] hover:text-[#e3e8d7]'}`}
        >
          <span>{t('camouflages')}</span><span className="text-xs text-[#aeb990]">{camouflages.length}</span>
        </button>
        <button
          type="button"
          aria-pressed={category === 'sounds'}
          onClick={() => onCategoryChange('sounds')}
          className={`flex min-h-11 items-center gap-2 border-b-2 px-3 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-olive ${category === 'sounds' ? 'border-olive bg-[#252c23] text-[#e3e8d7]' : 'border-transparent text-[#aab2a4] hover:bg-[#222820] hover:text-[#e3e8d7]'}`}
        >
          <span>{t('sounds')}</span><span className="text-xs text-[#aeb990]">{sounds.length}</span>
        </button>
      </div>

      <section className="mb-3 flex flex-wrap items-center gap-2.5" aria-label={t('favoritesControls')}>
        <label className="flex h-11 min-w-[240px] max-w-[490px] flex-1 items-center gap-2.5 border border-[#343b32] bg-wt-panel px-3 text-[#a0aa9b] focus-within:border-[#717d5b]">
          <Search size={17} aria-hidden="true" />
          <input
            ref={searchInputRef}
            className="min-w-0 flex-1 bg-transparent text-sm text-[#e2e5db] outline-none placeholder:text-[#929a8e]"
            value={query}
            onChange={event => category === 'sounds' ? onSoundQueryChange(event.target.value) : onCamouflageQueryChange(event.target.value)}
            placeholder={t(category === 'sounds' ? 'favoriteSoundsSearchPlaceholder' : 'searchPlaceholder')}
            aria-label={t(category === 'sounds' ? 'favoriteSoundsSearchLabel' : 'favoriteCamouflagesSearchLabel')}
          />
        </label>
        <Button variant="quiet" className="min-h-11 px-3 text-xs" onClick={() => category === 'sounds'
          ? onSoundSortChange(sort === 'recent' ? 'popular' : 'recent')
          : onCamouflageSortChange(sort === 'recent' ? 'popular' : 'recent')}
        >
          {t(sort)}<ChevronDown size={14} aria-hidden="true" />
        </Button>
      </section>

      <div className="mb-3.5 mt-3 flex items-center gap-2">
        <span className="ml-auto text-xs text-[#9fa89b]">{t('downloadsFilteredCount', { count: visibleItems.length })}</span>
      </div>

      {visibleItems.length === 0 ? (
        selectedItems.length > 0 ? (
          <div className="grid min-h-40 place-items-center text-center text-sm text-[#b1b7ab]">{t('noMatchingFavorites')}</div>
        ) : category === 'sounds' ? (
          <EmptyLibraryState
            kind="favorites"
            title={t('noFavorites')}
            description={t('favoriteSoundsEmpty')}
            exploreLabel={t('sounds')}
            onExplore={() => onExplore('sounds')}
          />
        ) : (
          <EmptyLibraryState kind="favorites" onExplore={() => onExplore('camouflages')} />
        )
      ) : (
        <PaginatedGrid
          items={visibleItems}
          resetKey={`favorites-${category}-${query}-${sort}`}
          getKey={item => `${item.contentType ?? 'camouflage'}-${item.id}`}
          renderGrid={items => (
            <MasonryPostGrid
              items={items}
              renderItem={item => (
                <PostCard
                  item={item}
                  contentType={item.contentType === 'sound' ? 'sound' : 'camouflage'}
                  isSaved
                  isDownloaded={isDownloaded(item)}
                  isInstalled={isInstalled(item)}
                  onOpen={onOpen}
                  onToggleSaved={onRemove}
                />
              )}
            />
          )}
        />
      )}
    </div>
  )
}
