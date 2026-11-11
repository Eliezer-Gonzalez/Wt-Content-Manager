import { LoaderCircle, RefreshCw } from 'lucide-react'
import { useI18n } from '../i18n/I18nProvider'
import type { SoundPackageUpdateController } from '../hooks/useSoundPackageUpdates'
import type { SoundPackage } from '../lib/sounds'
import { Button } from './ui/Button'

type Props = {
  updates: SoundPackageUpdateController
  packages: SoundPackage[]
}

export function SoundUpdateControls({ updates, packages }: Props) {
  const { t, locale } = useI18n()
  if (packages.length === 0) return null

  const currentGroups = new Set(packages
    .filter(packageInfo => updates.results[packageInfo.id]?.status === 'no-change')
    .map(packageInfo => packageInfo.langGroup))
  const possibleCount = new Set(packages
    .filter(packageInfo => updates.results[packageInfo.id]?.status === 'possible' && !currentGroups.has(packageInfo.langGroup))
    .map(packageInfo => packageInfo.langGroup)).size
  const unavailableCount = packages.filter(packageInfo => updates.results[packageInfo.id]?.status === 'unavailable').length
  const checkedAt = updates.lastCheckedAt == null
    ? t('soundUpdatesNeverChecked')
    : new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(updates.lastCheckedAt)

  return (
    <div className="mb-4 flex flex-wrap items-center gap-3 border border-[#343b32] bg-[#1d231d] px-3 py-3 text-xs text-[#bac2b0]">
      <div className="min-w-0 flex-1" role="status" aria-live="polite">
        <p className="mb-1 font-semibold text-[#d3e2ad]">{t('soundUpdatesTitle')}</p>
        <p className="mb-0 leading-5">
          {updates.checking
            ? t('soundUpdatesChecking', { completed: updates.completed, total: updates.total })
            : possibleCount > 0
              ? t('soundUpdatesPossibleCount', { count: possibleCount })
              : unavailableCount > 0
                ? t('soundUpdatesUnavailableCount', { count: unavailableCount })
                : updates.lastCheckedAt != null
                  ? t('soundUpdatesNoChanges')
                  : t('soundUpdatesPending')}
          {` · ${t('soundUpdatesLastChecked', { date: checkedAt })}`}
        </p>
        <p className="mb-0 mt-1 text-[11px] leading-4 text-[#919b8d]">{t('soundUpdatesMetadataLimit')}</p>
      </div>
      <Button size="sm" variant="secondary" onClick={() => void updates.refresh()} disabled={updates.checking}>
        {updates.checking
          ? <LoaderCircle size={14} className="animate-spin motion-reduce:animate-none" aria-hidden="true" />
          : <RefreshCw size={14} aria-hidden="true" />}
        {t(updates.checking ? 'soundUpdatesCheckingButton' : 'soundUpdatesCheckButton')}
      </Button>
    </div>
  )
}
