import { Bell, Volume2 } from 'lucide-react'
import { useI18n } from '../i18n/I18nContext'
import { playCompletionChime } from '../lib/completionChime'
import type { CompletionNotificationPreferences } from '../hooks/useCompletionNotificationSettings'
import { Button } from './ui/Button'

type Props = {
  preferences: CompletionNotificationPreferences
  onShowNotificationsChange: (enabled: boolean) => void
  onSoundEnabledChange: (enabled: boolean) => void
  onVolumeChange: (volume: number) => void
}

export function NotificationSettingsCard({ preferences, onShowNotificationsChange, onSoundEnabledChange, onVolumeChange }: Props) {
  const { t } = useI18n()
  return (
    <section className="border border-[#343b32] bg-[#1d231d]" aria-labelledby="notification-settings-title">
      <div className="flex items-start gap-3 border-b border-[#343b32] px-5 py-4">
        <span className="grid size-10 shrink-0 place-items-center border border-[#4b5640] bg-[#293027] text-[#bcc899]"><Bell size={18} aria-hidden="true" /></span>
        <div className="min-w-0 flex-1">
          <p className="mb-1 text-[10px] tracking-[.13em] text-[#9eaa85]">{t('settingsNotificationsEyebrow')}</p>
          <h2 id="notification-settings-title" className="mb-0 text-base font-medium text-[#e0e3d8]">{t('settingsNotificationsTitle')}</h2>
          <p className="mb-0 mt-1 text-xs leading-5 text-[#aab2a4]">{t('settingsNotificationsDescription')}</p>
        </div>
      </div>

      <div className="space-y-4 px-5 py-4">
        <SettingsSwitch
          id="completion-notifications-switch"
          label={t('settingsNotificationsShow')}
          checked={preferences.showNotifications}
          onChange={onShowNotificationsChange}
        />
        <SettingsSwitch
          id="completion-sound-switch"
          label={t('settingsNotificationsSound')}
          checked={preferences.soundEnabled}
          onChange={onSoundEnabledChange}
        />
        <div className="flex flex-wrap items-center gap-x-4 gap-y-3 border-t border-[#30372e] pt-4">
          <label htmlFor="completion-sound-volume" className="min-w-0 text-xs text-[#c1c8bb]">{t('settingsNotificationsVolume')}</label>
          <input
            id="completion-sound-volume"
            type="range"
            min="0"
            max="100"
            step="5"
            value={preferences.volume}
            disabled={!preferences.soundEnabled}
            aria-label={t('settingsNotificationsVolume')}
            onChange={event => onVolumeChange(Number(event.currentTarget.value))}
            className="min-w-[150px] flex-1 accent-[#aeb990] disabled:opacity-50"
          />
          <output htmlFor="completion-sound-volume" className="w-10 text-right text-xs tabular-nums text-[#aab2a4]">{preferences.volume}%</output>
          <Button variant="secondary" size="sm" disabled={!preferences.soundEnabled} onClick={() => playCompletionChime(preferences.volume)}>
            <Volume2 size={14} aria-hidden="true" />{t('settingsNotificationsPreview')}
          </Button>
        </div>
      </div>
    </section>
  )
}

type SwitchProps = {
  id: string
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
}

function SettingsSwitch({ id, label, checked, onChange }: SwitchProps) {
  return (
    <div className="flex min-h-9 items-center justify-between gap-4">
      <label htmlFor={id} className="min-w-0 text-xs text-[#c1c8bb]">{label}</label>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-11 shrink-0 border transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#aeb990] ${checked ? 'border-[#87956a] bg-[#69784f]' : 'border-[#596052] bg-[#252b24]'}`}
      >
        <span className={`absolute top-[3px] size-4 bg-[#e3e6dc] transition-[left] ${checked ? 'left-[22px]' : 'left-[3px]'}`} />
      </button>
    </div>
  )
}
