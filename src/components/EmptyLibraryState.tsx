import { ArrowRight, Bookmark, Download } from 'lucide-react'
import { Button } from './ui/Button'
import { useI18n } from '../i18n/I18nProvider'

type Props = {
  kind: 'favorites' | 'downloads'
  onExplore: () => void
  title?: string
  description?: string
  exploreLabel?: string
}

export function EmptyLibraryState({ kind, onExplore, title, description, exploreLabel }: Props) {
  const { t } = useI18n()
  const isFavorites = kind === 'favorites'
  const Icon = isFavorites ? Bookmark : Download
  return <section className="mx-auto grid min-h-64 max-w-lg place-items-center px-5 py-10 text-center" aria-live="polite">
    <div className="flex flex-col items-center">
      <div className="mb-5 grid size-14 place-items-center border border-[#3b4436] bg-[#242b22] text-[#aeb990]">
        <Icon size={23} strokeWidth={1.5} aria-hidden="true" />
      </div>
      <h3 className="mb-2 text-base font-medium text-[#e3e6dc]">{title ?? t(isFavorites ? 'noFavorites' : 'noInstalledSkins')}</h3>
      <p className="mb-5 max-w-sm text-sm leading-6 text-[#a6aea0]">{description ?? t(isFavorites ? 'emptyFavoritesHint' : 'emptyDownloadsHint')}</p>
      <Button variant="primary" onClick={onExplore}>
        {exploreLabel ?? t('camouflages')} <ArrowRight size={15} aria-hidden="true" />
      </Button>
    </div>
  </section>
}
