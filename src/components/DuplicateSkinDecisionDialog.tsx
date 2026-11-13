import { AlertTriangle, ChevronDown, Link2, X } from 'lucide-react'
import { useRef, useState } from 'react'
import { useFocusTrap } from '../hooks/useFocusTrap'
import type { DuplicateSkinCandidate } from '../lib/skins'
import { isTauriRuntime } from '../lib/gameInstall'
import { useI18n } from '../i18n/I18nContext'
import { Button } from './ui/Button'

type Props = {
  candidates: DuplicateSkinCandidate[]
  resolving: boolean
  error?: string
  onLinkExisting: (folderName: string) => void
  onReplaceExisting: (folderName: string) => void
  onInstallCopy: () => void
  onCancel: () => void
}

export function DuplicateSkinDecisionDialog({ candidates, resolving, error, onLinkExisting, onReplaceExisting, onInstallCopy, onCancel }: Props) {
  const { t } = useI18n()
  const dialogRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const [expandedPath, setExpandedPath] = useState<string | null>(null)
  const hasFolderNameMatch = candidates.some(candidate => candidate.folderNameMatch)

  useFocusTrap({
    containerRef: dialogRef,
    initialFocusRef: closeRef,
    onClose: onCancel,
    enabled: candidates.length > 0,
    canEscape: !resolving,
    stopPropagationOnEscape: true,
  })

  if (candidates.length === 0) return null

  return (
    <div
      className={`fixed inset-x-0 bottom-0 z-[80] grid place-items-center bg-black/80 p-4 ${isTauriRuntime ? 'top-9' : 'top-0'}`}
      onMouseDown={event => { if (!resolving && event.target === event.currentTarget) onCancel() }}
      onClick={event => event.stopPropagation()}
    >
      <div
        ref={dialogRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="skin-duplicate-title"
        aria-describedby="skin-duplicate-description"
        className={`flex w-full max-w-[560px] flex-col border border-[#796d42] bg-[#1e241e] text-[#e3e4dc] shadow-2xl ${isTauriRuntime ? 'max-h-[calc(100dvh-4.25rem)]' : 'max-h-[calc(100dvh-2rem)]'}`}
      >
        <header className="flex items-start gap-3 border-b border-[#514b34] px-5 py-4">
          <span className="grid size-9 shrink-0 place-items-center border border-[#685936] bg-[#2b281d] text-[#e3c36e]"><AlertTriangle size={17} aria-hidden="true" /></span>
          <div className="min-w-0 flex-1">
            <h2 id="skin-duplicate-title" className="mb-1 font-display text-lg font-semibold text-[#eee2b6]">{t(hasFolderNameMatch ? 'skinDuplicateNameTitle' : 'skinDuplicateTitle')}</h2>
            <p id="skin-duplicate-description" className="mb-0 text-xs leading-5 text-[#c8c1a8]">{t(hasFolderNameMatch ? 'skinDuplicateNameDescription' : 'skinDuplicateDescription')}</p>
          </div>
          <Button ref={closeRef} variant="icon" onClick={onCancel} disabled={resolving} aria-label={t('close')}><X size={17} aria-hidden="true" /></Button>
        </header>

        <div className="min-h-0 space-y-3 overflow-y-auto p-5">
          {error && <p className="mb-0 border border-amber-800/70 bg-amber-950/30 px-3 py-2 text-xs leading-5 text-amber-100" role="alert">{error}</p>}
          {candidates.map(candidate => {
            const expanded = expandedPath === candidate.path
            const detailKey = candidate.exactContent
              ? 'skinDuplicateExact'
              : candidate.folderNameMatch
                ? candidate.sameLayout ? 'skinDuplicateNameLayoutMatch' : 'skinDuplicateNameMatch'
                : 'skinDuplicatePossible'
            return (
              <section key={candidate.path} className="border border-[#514b34] bg-[#211f18] p-3">
                <strong className="block break-all text-sm text-[#e2dcc2]">{candidate.folderName}</strong>
                <p className="mb-3 mt-1 text-[11px] leading-5 text-[#b9b199]">{t(detailKey)}</p>
                <div className="flex flex-wrap items-center gap-2">
                  <Button variant="primary" size="sm" disabled={resolving} onClick={() => onLinkExisting(candidate.folderName)}>
                    <Link2 size={14} aria-hidden="true" /><span>{t('skinDuplicateLinkExisting')}</span>
                  </Button>
                  <Button
                    variant="quiet"
                    size="sm"
                    aria-expanded={expanded}
                    aria-controls={`skin-duplicate-options-${candidate.folderName}`}
                    onClick={() => setExpandedPath(expanded ? null : candidate.path)}
                  >
                    <span>{t('skinDuplicateOptions')}</span><ChevronDown size={14} className={`transition-transform ${expanded ? 'rotate-180' : ''}`} aria-hidden="true" />
                  </Button>
                </div>
                {expanded && <div id={`skin-duplicate-options-${candidate.folderName}`} className="mt-3 border-t border-[#514b34] pt-3">
                  {!candidate.exactContent && <div className="mb-3">
                    <p className="mb-2 text-[11px] leading-5 text-[#c8bfa4]">{t('skinDuplicateReplaceWarning')}</p>
                    <Button variant="danger" size="sm" className="w-full" disabled={resolving} onClick={() => onReplaceExisting(candidate.folderName)}>
                      {t('skinDuplicateReplaceExisting')}
                    </Button>
                  </div>}
                  <Button variant="secondary" size="sm" className="w-full" disabled={resolving} onClick={onInstallCopy}>
                    {t('skinDuplicateInstallCopy')}
                  </Button>
                </div>}
              </section>
            )
          })}
        </div>

        <footer className="flex justify-end border-t border-[#343b32] px-5 py-3">
          <Button variant="quiet" disabled={resolving} onClick={onCancel}>{t(resolving ? 'working' : 'cancelAction')}</Button>
        </footer>
      </div>
    </div>
  )
}
