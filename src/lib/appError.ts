import type { TranslateFn } from '../i18n/I18nProvider'
import { asTranslationKey } from '../i18n/I18nProvider'
import { WtLiveError } from '../wtLive'

export type BackendErrorPayload = {
  code: string
  params?: Record<string, string | number>
  detail?: string
}

export type FormattedError = {
  message: string
  detail?: string
}

function parsePotentialJson(value: string): BackendErrorPayload | null {
  try {
    const parsed = JSON.parse(value)
    if (typeof parsed === 'object' && parsed !== null && 'code' in parsed && typeof (parsed as { code: unknown }).code === 'string') {
      return parsed as BackendErrorPayload
    }
  } catch {
    // Not valid JSON
  }
  return null
}

export function formatAppError(error: unknown, t: TranslateFn): FormattedError {
  if (!error) {
    return { message: t('errors.unexpected') }
  }

  // 1. Structured backend error object { code, params?, detail? }
  if (typeof error === 'object' && error !== null && 'code' in error && typeof (error as { code: unknown }).code === 'string') {
    const backendError = error as BackendErrorPayload
    const errorNamespaceKey = asTranslationKey(backendError.code.startsWith('errors.') ? backendError.code : `errors.${backendError.code}`)
    let message = t(errorNamespaceKey, backendError.params)
    if (message === errorNamespaceKey) {
      const directKey = asTranslationKey(backendError.code)
      const directMessage = t(directKey, backendError.params)
      message = directMessage === directKey ? t('errors.unexpected') : directMessage
    }
    return {
      message,
      detail: backendError.detail || undefined,
    }
  }

  // 2. Typed WtLiveError from frontend fetcher
  if (error instanceof WtLiveError) {
    const errorNamespaceKey = asTranslationKey(error.code.startsWith('errors.') ? error.code : `errors.${error.code}`)
    let message = t(errorNamespaceKey, error.params)
    if (message === errorNamespaceKey) {
      const directKey = asTranslationKey(error.code)
      const directMessage = t(directKey, error.params)
      message = directMessage === directKey ? t('errors.unexpected') : directMessage
    }
    return { message }
  }

  // 3. Regular Error instance (check if message is stringified JSON from IPC)
  if (error instanceof Error) {
    const parsed = parsePotentialJson(error.message)
    if (parsed) {
      return formatAppError(parsed, t)
    }
    return {
      message: error.message || t('errors.unexpected'),
    }
  }

  // 4. String error (check if stringified JSON from IPC)
  if (typeof error === 'string') {
    const parsed = parsePotentialJson(error)
    if (parsed) {
      return formatAppError(parsed, t)
    }
    const errorNamespaceKey = asTranslationKey(error.startsWith('errors.') ? error : `errors.${error}`)
    let message = t(errorNamespaceKey)
    if (message === errorNamespaceKey) {
      const directKey = asTranslationKey(error)
      const directMessage = t(directKey)
      message = directMessage === directKey ? error : directMessage
    }
    return { message }
  }

  return { message: t('errors.unexpected') }
}
