import { Check, Link2, X } from 'lucide-react'
import { useRef } from 'react'
import { useFocusTrap } from '../hooks/useFocusTrap'
import type { LocalLibrary } from '../lib/localLibrary'
import type { SkinLinkCandidate } from '../lib/skinRepair'
import { isTauriRuntime } from '../lib/gameInstall'
import { useI18n } from '../i18n/I18nContext'
import { Button } from './ui/Button'

type Props = {
  open: boolean
  candidates: SkinLinkCandidate[]
  library: LocalLibrary
  autoLinked: number
  baselineCount: number
  resolving: boolean
  error?: 'skinRepairFailed' | 'skinRepairCandidateFailed'
  onConfirm: (candidate: SkinLinkCandidate) => void
  onClose: () => void
}

export function SkinRepairDialog({ open, candidates, library, autoLinked, baselineCount, resolving, error, onConfirm, onClose }: Props) {
  const { t } = useI18n()
  const dialogRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  useFocusTrap({ containerRef: dialogRef, initialFocusRef: closeRef, onClose, enabled: open, canEscape: !resolving, stopPropagationOnEscape: true })
  if (!open) return null

  return (
    <div className={`fixed inset-x-0 bottom-0 z-[80] grid place-items-center bg-black/80 p-4 ${isTauriRuntime ? 'top-9' : 'top-0'}`} onMouseDown={event => { if (!resolving && event.target === event.currentTarget) onClose() }} onClick={event => event.stopPropagation()}>
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="skin-repair-title" className={`flex w-full max-w-[620px] flex-col border border-[#536044] bg-[#1e241e] text-[#e3e4dc] shadow-2xl ${isTauriRuntime ? 'max-h-[calc(100dvh-4.25rem)]' : 'max-h-[calc(100dvh-2rem)]'}`}>
        <header className="flex items-start gap-3 border-b border-[#343b32] px-5 py-4">
          <span className="grid size-9 shrink-0 place-items-center border border-[#4b5640] bg-[#293027] text-[#bdc99e]"><Link2 size={16} aria-hidden="true" /></span>
          <div className="min-w-0 flex-1">
            <h2 id="skin-repair-title" className="mb-1 font-display text-lg font-semibold">{t('skinRepairTitle')}</h2>
            <p className="mb-0 text-xs leading-5 text-[#aeb7a3]">{t('skinRepairSummary', { count: autoLinked })}</p>
          </div>
          <Button ref={closeRef} variant="icon" onClick={onClose} disabled={resolving} aria-label={t('close')}><X size={17} aria-hidden="true" /></Button>
        </header>
        <div className="min-h-0 space-y-3 overflow-y-auto p-5">
          {baselineCount > 0 && <p className="mb-0 border border-[#68603c] bg-[#2b281d] px-3 py-2 text-xs leading-5 text-[#e3d79e]">{t('skinRepairBaselineSummary', { count: baselineCount })}</p>}
          <p className="mb-0 text-xs leading-5 text-[#aeb7a3]">{t('skinRepairScoreFormula')}</p>
          {error && <p className="mb-0 border border-amber-800/70 bg-amber-950/30 px-3 py-2 text-xs text-amber-100" role="alert">{t(error)}</p>}
          {candidates.length === 0 ? <p className="mb-0 border border-[#343b32] px-3 py-4 text-sm text-[#b8c0ae]">{t('skinRepairNoCandidates')}</p> : candidates.map((candidate, index) => {
            const publication = candidate.item ?? candidate.externalPublication?.item ?? library.installedSkins.find(entry => entry.path === candidate.recordPath)?.item
            return <section key={`${candidate.recordPath}:${candidate.folderPath}:${index}`} className="border border-[#414a3b] bg-[#20271f] p-3">
              <strong className="block break-words text-sm">{candidate.folderName}</strong>
              {publication && <p className="mb-1 mt-1 text-xs text-[#c2caa9]">{publication.title}</p>}
              <p className="mb-3 mt-1 text-xs leading-5 text-[#aeb7a3]">{candidate.reason === 'nameOnly' || candidate.reason === 'legacyName' ? t('skinRepairNameOnly') : t('skinRepairCandidateEvidence', { percent: candidate.matchPercent, files: candidate.matchingFiles, total: candidate.totalFiles })}</p>
              <Button variant="secondary" size="sm" disabled={resolving} onClick={() => onConfirm(candidate)}><Check size={14} aria-hidden="true" />{t('skinRepairConfirm')}</Button>
            </section>
          })}
        </div>
        <footer className="flex justify-end border-t border-[#343b32] px-5 py-3"><Button variant="quiet" onClick={onClose} disabled={resolving}>{t('close')}</Button></footer>
      </div>
    </div>
  )
}
