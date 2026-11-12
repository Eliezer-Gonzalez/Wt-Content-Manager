import type { TranslationKey } from './I18nProvider'

export function asTranslationKey(key: string): TranslationKey {
  return key as TranslationKey
}
