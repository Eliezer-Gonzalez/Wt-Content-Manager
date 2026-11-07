import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

type Messages = Record<string, string>
type LocaleContextValue = { locale: string; languages: Array<{ code: string; name: string }>; setLocale: (code: string) => void; t: (key: string) => string }
const localeModules = import.meta.glob('./locales/*.json', { eager: true, import: 'default' }) as Record<string, Messages>
const locales = Object.fromEntries(Object.entries(localeModules).map(([path, messages]) => [path.match(/([^/]+)\.json$/)?.[1] ?? 'es', messages]))
const defaultLocale = Object.keys(locales).includes('es') ? 'es' : Object.keys(locales)[0] ?? 'en'
const Context = createContext<LocaleContextValue | null>(null)

function preferredLocale() {
  try {
    const saved = localStorage.getItem('wt-content-manager-language')
    if (saved && locales[saved]) return saved
  } catch { /* Storage may be unavailable in restricted webviews. */ }
  const browser = navigator.language.split('-')[0]
  return locales[browser] ? browser : defaultLocale
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState(preferredLocale)
  const languages = useMemo(() => Object.entries(locales).map(([code, messages]) => ({ code, name: messages.languageName ?? code })), [])
  const setLocale = (code: string) => { if (locales[code]) setLocaleState(code) }
  const t = (key: string) => locales[locale]?.[key] ?? locales[defaultLocale]?.[key] ?? key
  useEffect(() => {
    try { localStorage.setItem('wt-content-manager-language', locale) } catch { /* Ignore unavailable storage. */ }
    document.documentElement.lang = locale
  }, [locale])
  return <Context.Provider value={{ locale, languages, setLocale, t }}>{children}</Context.Provider>
}

export function useI18n() {
  const context = useContext(Context)
  if (!context) throw new Error('useI18n must be used inside I18nProvider')
  return context
}
