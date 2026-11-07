import { useCallback, useEffect, useRef, useState } from 'react'
import { fetchPostDetail, type WtLiveDetail, type WtLiveItem } from '../lib/wtLive'
import { formatAppError } from '../lib/appError'
import { useI18n } from '../i18n/I18nProvider'

type Options = {
  onResetInstallState?: () => void
}

export function usePostDetail({ onResetInstallState }: Options = {}) {
  const { t } = useI18n()
  const [selected, setSelected] = useState<WtLiveItem | null>(null)
  const [detail, setDetail] = useState<WtLiveDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState('')
  const detailRequestIdRef = useRef(0)

  const openPost = useCallback((item: WtLiveItem) => {
    onResetInstallState?.()
    setSelected(item)
  }, [onResetInstallState])

  const closePost = useCallback(() => {
    onResetInstallState?.()
    setSelected(null)
  }, [onResetInstallState])

  useEffect(() => {
    const requestId = ++detailRequestIdRef.current
    if (!selected) {
      setDetail(null)
      return
    }
    const controller = new AbortController()
    setDetail(null)
    setDetailError('')
    setDetailLoading(true)
    fetchPostDetail(selected, controller.signal)
      .then(result => {
        if (requestId !== detailRequestIdRef.current) return
        setDetail(result)
      })
      .catch((cause: unknown) => {
        if (requestId !== detailRequestIdRef.current) return
        if (!(cause instanceof Error && cause.name === 'AbortError')) {
          const formatted = formatAppError(cause, t)
          setDetailError(formatted.detail ? `${formatted.message} (${formatted.detail})` : formatted.message)
        }
      })
      .finally(() => {
        if (requestId === detailRequestIdRef.current) setDetailLoading(false)
      })
    return () => controller.abort()
  }, [selected, t])

  return {
    selected,
    detail,
    detailLoading,
    detailError,
    openPost,
    closePost,
  }
}
