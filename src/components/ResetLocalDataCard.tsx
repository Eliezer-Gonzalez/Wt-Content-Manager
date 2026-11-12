import { useState } from 'react'
import { RotateCcw } from 'lucide-react'
import { resetLocalData } from '../lib/localData'
import { useI18n } from '../i18n/I18nContext'
import { ConfirmResetLocalDataModal } from './ConfirmResetLocalDataModal'
import { Button } from './ui/Button'

export function ResetLocalDataCard() {
  const { t } = useI18n()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [error, setError] = useState(false)

  function handleConfirm() {
    try {
      resetLocalData()
      window.location.reload()
    } catch {
      setError(true)
    }
  }

  return (
    <>
      <section className="flex flex-wrap items-center gap-4 border border-[#6b493f] bg-[#211b18] px-5 py-4" aria-labelledby="reset-local-data-title">
        <span className="grid size-10 shrink-0 place-items-center border border-[#644b42] bg-[#2a201d] text-[#d2a894]"><RotateCcw size={18} aria-hidden="true" /></span>
        <div className="min-w-0 flex-1">
          <p className="mb-1 text-[10px] tracking-[.13em] text-[#d0a08b]">{t('settingsDangerZone')}</p>
          <h2 id="reset-local-data-title" className="mb-1 text-sm font-medium text-[#e0e3d8]">{t('settingsResetLocalDataTitle')}</h2>
          <p className="mb-0 text-xs leading-5 text-[#969f92]">{t('settingsResetLocalDataHint')}</p>
        </div>
        <Button variant="danger" size="sm" onClick={() => { setError(false); setConfirmOpen(true) }}>{t('settingsResetLocalDataAction')}</Button>
      </section>
      <ConfirmResetLocalDataModal
        open={confirmOpen}
        error={error}
        onConfirm={handleConfirm}
        onClose={() => { setConfirmOpen(false); setError(false) }}
      />
    </>
  )
}
