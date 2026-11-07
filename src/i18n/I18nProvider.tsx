import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import en from './locales/en.json'

type Messages = Record<string, string>

type RawTranslationKey = keyof typeof en
type PluralSuffix = '_zero' | '_one' | '_two' | '_few' | '_many' | '_other'
type PluralBaseKey<K extends string> = K extends `${infer Base}${PluralSuffix}` ? Base : never
export type TranslationKey = RawTranslationKey | PluralBaseKey<RawTranslationKey>

export function asTranslationKey(key: string): TranslationKey {
  return key as TranslationKey
}

export type TranslationParams = Record<string, string | number>
export type TranslateFn = (key: TranslationKey, params?: TranslationParams) => string

type LocaleContextValue = {
  locale: string
  languages: Array<{ code: string; name: string }>
  setLocale: (code: string) => void
  t: TranslateFn
}

const localeModules = import.meta.glob('./locales/*.json', { eager: true, import: 'default' }) as Record<string, Messages>
const locales: Record<string, Messages> = Object.fromEntries(
  Object.entries(localeModules).map(([path, messages]) => [path.match(/([^/]+)\.json$/)?.[1] ?? 'en', messages]),
)

const defaultLocale = 'en'
const Context = createContext<LocaleContextValue | null>(null)

const pluralRulesCache = new Map<string, Intl.PluralRules>()
const numberFormatCache = new Map<string, Intl.NumberFormat>()
const warnedMissingKeys = new Set<string>()

function getPluralRules(locale: string): Intl.PluralRules {
  let rules = pluralRulesCache.get(locale)
  if (!rules) {
    rules = new Intl.PluralRules(locale)
    pluralRulesCache.set(locale, rules)
  }
  return rules
}

function getNumberFormat(locale: string): Intl.NumberFormat {
  let nf = numberFormatCache.get(locale)
  if (!nf) {
    nf = new Intl.NumberFormat(locale)
    numberFormatCache.set(locale, nf)
  }
  return nf
}

function preferredLocale(): string {
  try {
    const saved = localStorage.getItem('wt-content-manager-language')
    if (saved && locales[saved]) return saved
  } catch {
    /* Storage may be unavailable in restricted webviews. */
  }
  const browser = typeof navigator !== 'undefined' ? navigator.language.split('-')[0] : defaultLocale
  return locales[browser] ? browser : defaultLocale
}

function resolveTranslationString(
  activeLocale: string,
  key: string,
  params?: TranslationParams,
): string {
  const candidateKeys: string[] = []

  if (params && typeof params.count === 'number') {
    const rules = getPluralRules(activeLocale)
    const category = rules.select(params.count)
    candidateKeys.push(`${key}_${category}`)
    if (category !== 'other') {
      candidateKeys.push(`${key}_other`)
    }
  }
  candidateKeys.push(key)

  let rawString: string | undefined

  for (const candidate of candidateKeys) {
    const activeMsg = locales[activeLocale]?.[candidate]
    if (activeMsg !== undefined) {
      rawString = activeMsg
      break
    }
    const fallbackMsg = locales[defaultLocale]?.[candidate]
    if (fallbackMsg !== undefined) {
      rawString = fallbackMsg
      break
    }
  }

  if (rawString === undefined) {
    if (import.meta.env?.DEV && !warnedMissingKeys.has(key)) {
      warnedMissingKeys.add(key)
      console.warn(`[i18n] Missing translation key: "${key}" (locale: "${activeLocale}")`)
    }
    rawString = key
  }

  if (!params) {
    return rawString
  }

  const formattedCount =
    typeof params.count === 'number'
      ? getNumberFormat(activeLocale).format(params.count)
      : undefined

  return rawString.replace(/\{([a-zA-Z0-9_]+)\}/g, (match, paramName: string) => {
    if (paramName === 'count' && formattedCount !== undefined) {
      return formattedCount
    }
    if (paramName in params) {
      return String(params[paramName])
    }
    return match
  })
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<string>(preferredLocale)

  const languages = useMemo(
    () =>
      Object.entries(locales).map(([code, messages]) => ({
        code,
        name: messages.languageName ?? code,
      })),
    [],
  )

  const setLocale = useCallback((code: string) => {
    if (locales[code]) setLocaleState(code)
  }, [])

  const t = useCallback<TranslateFn>(
    (key, params) => resolveTranslationString(locale, key as string, params),
    [locale],
  )

  useEffect(() => {
    try {
      localStorage.setItem('wt-content-manager-language', locale)
    } catch {
      /* Ignore unavailable storage. */
    }
    document.documentElement.lang = locale
  }, [locale])

  const value = useMemo(() => ({ locale, languages, setLocale, t }), [locale, languages, setLocale, t])

  return <Context.Provider value={value}>{children}</Context.Provider>
}

export function useI18n() {
  const context = useContext(Context)
  if (!context) throw new Error('useI18n must be used inside I18nProvider')
  return context
}
