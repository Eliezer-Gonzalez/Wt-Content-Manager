import { useState } from 'react'
import { Broom, LoaderCircle, RefreshCw } from 'lucide-react'
import type { GameInstall } from '../lib/gameInstall'
import { formatFileSize } from '../lib/format'
import { useTemporaryFiles } from '../hooks/useTemporaryFiles'
import { asTranslationKey, useI18n } from '../i18n/I18nProvider'
import { ConfirmCleanupTemporaryFilesModal } from './ConfirmCleanupTemporaryFilesModal'
import { Button } from './ui/Button'
import { AppTooltip } from './ui/AppTooltip'

type Props = { gameInstall: GameInstall | null }

export function TemporaryFilesCard({ gameInstall }: Props) {
  const { t, locale } = useI18n()
  const temporaryFiles = useTemporaryFiles(gameInstall?.path)
  const [confirmOpen, setConfirmOpen] = useState(false)

  async function handleCleanup() {
    await temporaryFiles.clean()
    setConfirmOpen(false)
  }

  const directoryCount = temporaryFiles.report?.directoryCount ?? 0
  const totalBytes = temporaryFiles.report?.totalBytes ?? 0

  return (
    <>
      <section className="border border-[#343b32] bg-[#1d231d]" aria-labelledby="temporary-files-title">
        <div className="flex items-start gap-3 border-b border-[#343b32] px-5 py-4">
          <span className="grid size-10 shrink-0 place-items-center border border-[#4b5640] bg-[#293027] text-[#bcc899]"><Broom size={19} aria-hidden="true" /></span>
          <div className="min-w-0 flex-1">
            <p className="mb-1 text-[10px] tracking-[.13em] text-[#9eaa85]">{t('settingsTemporaryEyebrow')}</p>
            <h2 id="temporary-files-title" className="mb-0 text-base font-medium text-[#e0e3d8]">{t('settingsTemporaryTitle')}</h2>
          </div>
          <AppTooltip content={t('settingsTemporaryRefresh')} align="end">
            <Button variant="icon" onClick={() => void temporaryFiles.refresh()} disabled={!gameInstall || temporaryFiles.loading || temporaryFiles.busy} aria-label={t('settingsTemporaryRefresh')}>
              <RefreshCw size={15} className={temporaryFiles.loading ? 'animate-spin motion-reduce:animate-none' : ''} aria-hidden="true" />
            </Button>
          </AppTooltip>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-4 px-5 py-4">
          <div className="min-w-0 flex-1 text-xs leading-5 text-[#aab2a4]" aria-live="polite" aria-atomic="true">
            {!temporaryFiles.supported ? <p className="mb-0">{t('settingsTemporaryDesktopOnly')}</p>
              : !gameInstall ? <p className="mb-0">{t('settingsTemporaryNeedsGame')}</p>
                : temporaryFiles.loading ? <p className="mb-0">{t('settingsTemporaryScanning')}</p>
                  : temporaryFiles.error ? <p className="mb-0 text-amber-200" role="alert">{t(asTranslationKey(temporaryFiles.error))}</p>
                    : temporaryFiles.lastCleanup ? <p className="mb-0" role="status">{t('settingsTemporaryCleaned', {
                      count: temporaryFiles.lastCleanup.removedDirectories,
                      size: formatFileSize(temporaryFiles.lastCleanup.freedBytes, locale),
                    })}{temporaryFiles.lastCleanup.failedDirectories > 0 && ` ${t('settingsTemporaryFailedCount', { count: temporaryFiles.lastCleanup.failedDirectories })}`}</p>
                      : directoryCount > 0 ? <p className="mb-0">{t('settingsTemporaryFound', { count: directoryCount, size: formatFileSize(totalBytes, locale) })}</p>
                        : <p className="mb-0">{t('settingsTemporaryNone')}</p>}
            <p className="mb-0 mt-1 text-[11px] text-[#838d7f]">{t('settingsTemporaryHint')}</p>
          </div>
          <Button variant="secondary" size="sm" onClick={() => setConfirmOpen(true)} disabled={!gameInstall || !temporaryFiles.report || directoryCount === 0 || temporaryFiles.loading || temporaryFiles.busy}>
            {temporaryFiles.busy ? <LoaderCircle size={14} className="animate-spin motion-reduce:animate-none" aria-hidden="true" /> : <Broom size={14} aria-hidden="true" />}{t(temporaryFiles.busy ? 'settingsTemporaryCleaningAction' : 'settingsTemporaryCleanAction')}
          </Button>
        </div>
      </section>
      <ConfirmCleanupTemporaryFilesModal
        open={confirmOpen}
        directoryCount={directoryCount}
        totalBytes={totalBytes}
        busy={temporaryFiles.busy}
        onConfirm={() => void handleCleanup()}
        onClose={() => { if (!temporaryFiles.busy) setConfirmOpen(false) }}
      />
    </>
  )
}
