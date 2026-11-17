import { useRef, useState } from 'react'
import { Download, FolderInput, Library } from 'lucide-react'
import { useI18n } from '../i18n/I18nContext'
import { Button } from './ui/Button'

const maxImportBytes = 16 * 1024 * 1024

type Props = {
  exportLibrary: () => string
  onImport: (value: unknown) => Promise<unknown>
  disabled?: boolean
}

export function LocalLibraryTransferCard({ exportLibrary, onImport, disabled = false }: Props) {
  const { t } = useI18n()
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [matchedCount, setMatchedCount] = useState(0)

  function exportData() {
    setStatus('idle')
    const file = new Blob([exportLibrary()], { type: 'application/json' })
    const url = URL.createObjectURL(file)
    const link = document.createElement('a')
    link.href = url
    link.download = 'wt-content-manager-library.json'
    document.body.append(link)
    link.click()
    link.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 0)
  }

  async function importData(file?: File) {
    if (!file) return
    setBusy(true)
    setStatus('idle')
    try {
      if (file.size > maxImportBytes) throw new Error('File too large')
      const result = await onImport(JSON.parse(await file.text()) as unknown)
      setMatchedCount(typeof result === 'number' ? result : 0)
      setStatus('success')
    } catch {
      setStatus('error')
    } finally {
      setBusy(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <section className="border border-[#343b32] bg-[#1d231d]" aria-labelledby="library-transfer-title">
      <div className="flex items-start gap-3 border-b border-[#343b32] px-5 py-4">
        <span className="grid size-10 shrink-0 place-items-center border border-[#4b5640] bg-[#293027] text-[#bcc899]"><Library size={18} aria-hidden="true" /></span>
        <div className="min-w-0 flex-1">
          <p className="mb-1 text-[10px] tracking-[.13em] text-[#9eaa85]">{t('libraryLocal')}</p>
          <h2 id="library-transfer-title" className="mb-0 text-base font-medium text-[#e0e3d8]">{t('libraryTransferTitle')}</h2>
        </div>
      </div>
      <div className="space-y-4 px-5 py-4">
        <p className="mb-0 text-xs leading-5 text-[#aab2a4]">{t('libraryTransferDescription')}</p>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" onClick={exportData} disabled={disabled || busy}>
            <Download size={14} aria-hidden="true" />{t('libraryTransferExport')}
          </Button>
          <Button variant="quiet" size="sm" onClick={() => inputRef.current?.click()} disabled={disabled || busy}>
            <FolderInput size={14} aria-hidden="true" />{t(busy ? 'libraryTransferImporting' : 'libraryTransferImport')}
          </Button>
          <input ref={inputRef} type="file" accept="application/json,.json" className="sr-only" aria-label={t('libraryTransferImport')} onChange={event => void importData(event.currentTarget.files?.[0])} />
        </div>
        {status !== 'idle' && <p className={`mb-0 text-xs ${status === 'success' ? 'text-[#bdc99e]' : 'text-amber-200'}`} role={status === 'error' ? 'alert' : 'status'}>
          {status === 'success'
            ? t(matchedCount > 0 ? 'libraryTransferImportSuccess' : 'libraryTransferImportNoMatches', { count: matchedCount })
            : t('libraryTransferImportFailed')}
        </p>}
      </div>
    </section>
  )
}
