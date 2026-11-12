import { createContext, useContext } from 'react'
import type { LocaleContextValue } from './I18nProvider'

export const Context = createContext<LocaleContextValue | null>(null)

export function useI18n() {
  const context = useContext(Context)
  if (!context) throw new Error('useI18n must be used inside I18nProvider')
  return context
}
