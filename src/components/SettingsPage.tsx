import { useState } from 'react'
import { Copy, FileText, FolderOpen, Gamepad2, LoaderCircle, ShieldCheck } from 'lucide-react'
import { SectionHeader } from './HeroBanner'
import { Button } from './ui/Button'
import { openUserSkinsFolder } from '../lib/settings'
import type { GameInstall } from '../lib/gameInstall'
import type { useDiagnosticsSettings } from '../hooks/useDiagnosticsSettings'
import { asTranslationKey, useI18n } from '../i18n/I18nProvider'
import { SettingsAboutCard } from './SettingsAboutCard'
import { TemporaryFilesCard } from './TemporaryFilesCard'
import { ResetLocalDataCard } from './ResetLocalDataCard'
import { ImageQualitySettingsCard } from './ImageQualitySettingsCard'
import type { ImageQualityMode } from '../lib/imageQuality'
import { waitForMinimumLoadingDuration } from '../lib/minimumLoadingDuration'

type DiagnosticsState = ReturnType<typeof useDiagnosticsSettings>

type Props = {
  gameInstall: GameInstall | null
  gameLoading: boolean
  diagnostics: DiagnosticsState
  imageQuality: ImageQualityMode
  onChangeImageQuality: (quality: ImageQualityMode) => void
  onOpenGameSetup: () => void
  onRescanGame: () => void
  onViewLegalNotice: () => void
}

export function SettingsPage({ gameInstall, gameLoading, diagnostics, imageQuality, onChangeImageQuality, onOpenGameSetup, onRescanGame, onViewLegalNotice }: Props) {
  const { t } = useI18n()
  const diagnosticsEnabled = diagnostics.settings?.enabled ?? diagnostics.supported
  const [userSkinsError, setUserSkinsError] = useState(false)
  const [openingUserSkins, setOpeningUserSkins] = useState(false)

  async function handleOpenUserSkins() {
    if (!gameInstall || openingUserSkins) return
    const startedAt = Date.now()
    setOpeningUserSkins(true)
    setUserSkinsError(false)
    try {
      await openUserSkinsFolder(gameInstall.path)
    } catch {
      setUserSkinsError(true)
    } finally {
      await waitForMinimumLoadingDuration(startedAt)
      setOpeningUserSkins(false)
    }
  }

  return (
    <div className="flex w-full flex-1 flex-col px-8 pb-8 pt-8 max-[1100px]:px-6 max-[720px]:px-4 max-[720px]:pt-6">
      <SectionHeader
        variant="hazard"
        size="compact"
        eyebrow={t('libraryLocal')}
        titleHighlight={t('settings')}
      />

      <div className="mt-6 grid w-full min-w-0 grid-cols-1 gap-4 xl:grid-cols-2">
        <section className="border border-[#343b32] bg-[#1d231d]" aria-labelledby="game-settings-title">
          <div className="flex items-start gap-3 border-b border-[#343b32] px-5 py-4">
            <span className="grid size-10 shrink-0 place-items-center border border-[#4b5640] bg-[#293027] text-[#bcc899]"><Gamepad2 size={19} /></span>
            <div className="min-w-0 flex-1">
              <p className="mb-1 text-[10px] tracking-[.13em] text-[#9eaa85]">{t('game')}</p>
              <h2 id="game-settings-title" className="mb-0 text-base font-medium text-[#e0e3d8]">{t('settingsGameTitle')}</h2>
            </div>
            <span className="mt-1 flex shrink-0 items-center gap-1.5 text-[10px] text-[#aab2a4]" role="status" aria-live="polite">
              <span className={`size-2 rounded-full ${gameInstall ? 'bg-[#9cae70]' : gameLoading ? 'animate-pulse bg-[#c7a76b] motion-reduce:animate-none' : 'bg-[#aa775d]'}`} aria-hidden="true" />
              {t(gameInstall ? 'settingsGameDetected' : gameLoading ? 'settingsGameSearching' : 'settingsGameMissing')}
            </span>
          </div>
          <div className="space-y-4 px-5 py-4">
            <div>
              <p className="mb-1 text-xs text-[#969f92]">{t('settingsGamePath')}</p>
              <p className="mb-0 break-all border border-[#30372e] bg-[#171c17] px-3 py-2.5 text-xs leading-5 text-[#c9d0bf]">
                {gameLoading ? (
                  <span className="flex items-center gap-2 text-[#bdc99e]">
                    <LoaderCircle size={14} className="shrink-0 animate-spin motion-reduce:animate-none" aria-hidden="true" />
                    {t('gameSetupSearching')}
                  </span>
                ) : gameInstall?.path ?? (gameLoading ? t('detecting') : t('notDetected'))}
              </p>
              <p className="mb-0 mt-2 text-xs leading-5 text-[#90998c]">{t('settingsGameHint')}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" size="sm" onClick={onOpenGameSetup}>
                <FolderOpen size={14} />{t(gameInstall ? 'settingsChangeGamePath' : 'settingsChooseGamePath')}
              </Button>
              <Button variant="quiet" size="sm" onClick={onRescanGame} disabled={gameLoading}>
                {gameLoading && <LoaderCircle size={14} className="animate-spin motion-reduce:animate-none" aria-hidden="true" />}
                {t(gameLoading ? 'gameSetupSearching' : 'gameSetupRescan')}
              </Button>
              <Button variant="secondary" size="sm" onClick={() => void handleOpenUserSkins()} disabled={!gameInstall || openingUserSkins}>
                {openingUserSkins ? <LoaderCircle size={14} className="animate-spin motion-reduce:animate-none" aria-hidden="true" /> : <FolderOpen size={14} aria-hidden="true" />}{t(openingUserSkins ? 'settingsOpenUserSkinsWorking' : 'settingsOpenUserSkins')}
              </Button>
            </div>
            {userSkinsError && <p className="mb-0 text-xs text-amber-200" role="alert">{t('settingsOpenUserSkinsFailed')}</p>}
          </div>
        </section>

        <section className="flex flex-col border border-[#343b32] bg-[#1d231d]" aria-labelledby="diagnostics-title">
          <div className="flex items-start gap-3 border-b border-[#343b32] px-5 py-4">
            <span className="grid size-10 shrink-0 place-items-center border border-[#4b5640] bg-[#293027] text-[#bcc899]"><FileText size={18} /></span>
            <div className="min-w-0 flex-1">
              <p className="mb-1 flex items-center gap-1.5 text-[10px] tracking-[.13em] text-[#9eaa85]">{diagnostics.action === 'toggle' && <LoaderCircle size={12} className="animate-spin motion-reduce:animate-none" aria-hidden="true" />}{t(diagnostics.action === 'toggle' ? 'settingsDiagnosticsWorking' : 'settingsDiagnosticsEyebrow')}</p>
              <h2 id="diagnostics-title" className="mb-0 text-base font-medium text-[#e0e3d8]">{t('settingsDiagnosticsTitle')}</h2>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={diagnosticsEnabled}
              aria-label={t('settingsDiagnosticsToggle')}
              disabled={!diagnostics.supported || !diagnostics.settings || diagnostics.busy}
              onClick={() => void diagnostics.toggle()}
              className={`relative mt-1 h-6 w-11 shrink-0 border transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#aeb990] disabled:cursor-not-allowed disabled:opacity-50 ${diagnosticsEnabled ? 'border-[#87956a] bg-[#69784f]' : 'border-[#596052] bg-[#252b24]'}`}
            >
              <span className={`absolute top-[3px] size-4 bg-[#e3e6dc] transition-[left] ${diagnosticsEnabled ? 'left-[22px]' : 'left-[3px]'}`} />
            </button>
          </div>
          <div className="flex flex-1 flex-col gap-4 px-5 py-4">
            <div className="flex items-start gap-2.5 text-xs leading-5 text-[#aab2a4]">
              <ShieldCheck size={16} className="mt-0.5 shrink-0 text-[#aeb990]" />
              <p className="mb-0">{t('settingsDiagnosticsPrivacy')}</p>
            </div>
            {!diagnostics.supported && <p className="mb-0 text-xs text-[#c7a76b]">{t('settingsDiagnosticsDesktopOnly')}</p>}
            {(diagnostics.error || diagnostics.notice) && <div className="flex min-h-10 items-center overflow-hidden" aria-live="polite" aria-atomic="true">
              {diagnostics.error ? (
                <p className="mb-0 line-clamp-2 text-xs leading-4 text-[#d39b83]" role="alert">{t(asTranslationKey(diagnostics.error))}</p>
              ) : (
                <p className="mb-0 line-clamp-2 text-xs leading-4 text-[#b9c59d]" role="status">{t(asTranslationKey(diagnostics.notice))}</p>
              )}
            </div>}
            <div className="mt-auto flex flex-wrap gap-2 border-t border-[#30372e] pt-3">
              <Button variant="secondary" size="sm" onClick={() => void diagnostics.copyLogs()} disabled={!diagnostics.settings?.hasLogs || diagnostics.busy}>
                {diagnostics.action === 'copy' ? <LoaderCircle size={14} className="animate-spin motion-reduce:animate-none" aria-hidden="true" /> : <Copy size={14} />}{t(diagnostics.action === 'copy' ? 'settingsCopyLogsWorking' : 'settingsCopyLogs')}
              </Button>
              <Button variant="quiet" size="sm" onClick={() => void diagnostics.openFolder()} disabled={!diagnostics.settings || diagnostics.busy}>
                {diagnostics.action === 'open' ? <LoaderCircle size={14} className="animate-spin motion-reduce:animate-none" aria-hidden="true" /> : <FolderOpen size={14} />}{t(diagnostics.action === 'open' ? 'settingsOpenLogsFolderWorking' : 'settingsOpenLogsFolder')}
              </Button>
            </div>
          </div>
        </section>

        <ImageQualitySettingsCard value={imageQuality} onChange={onChangeImageQuality} />
        <div className="min-w-0 xl:col-span-2"><TemporaryFilesCard gameInstall={gameInstall} /></div>
        <div className="min-w-0 xl:col-span-2">
          <SettingsAboutCard onViewLegalNotice={onViewLegalNotice} />
        </div>
        <div className="min-w-0 xl:col-span-2"><ResetLocalDataCard /></div>
      </div>
    </div>
  )
}
