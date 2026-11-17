import { LoaderCircle, ShieldAlert } from 'lucide-react'
import { useI18n } from '../i18n/I18nContext'
import { Button } from './ui/Button'

type Props = { error: boolean; onRetry: () => void; desktop?: boolean }

export function LocalLibraryStartupGate({ error, onRetry, desktop = false }: Props) {
  const { t } = useI18n()
  return (
    <main className={`grid ${desktop ? 'h-[calc(100dvh-36px)] min-h-0' : 'min-h-screen'} place-items-center bg-wt-bg px-5 text-[#e3e4dc]`}>
      <section className="w-full max-w-lg border border-[#343b32] bg-[#1d231d] p-6" role={error ? 'alert' : 'status'} aria-live="polite">
        <div className="mb-3 flex items-center gap-2 text-[#c3ceaa]">
          {error ? <ShieldAlert size={18} aria-hidden="true" /> : <LoaderCircle size={18} className="animate-spin motion-reduce:animate-none" aria-hidden="true" />}
          <h1 className="m-0 text-base font-medium">{t(error ? 'localLibraryLoadFailed' : 'localLibraryLoading')}</h1>
        </div>
        {error && <>
          <p className="mb-4 text-sm leading-6 text-[#aab2a4]">{t('localLibraryLoadFailedDescription')}</p>
          <Button variant="secondary" onClick={onRetry}>{t('localLibraryRetry')}</Button>
        </>}
      </section>
    </main>
  )
}
