import { useCallback, useState } from 'react'

const acknowledgementKey = 'wt-content-manager-independent-notice-v4'

function hasAcknowledgedNotice() {
  try {
    return localStorage.getItem(acknowledgementKey) === 'true'
  } catch {
    return false
  }
}

export function useLegalNotice() {
  const [isRequired, setIsRequired] = useState(() => !hasAcknowledgedNotice())
  const [isOpen, setIsOpen] = useState(isRequired)
  const acknowledge = useCallback(() => {
    try {
      localStorage.setItem(acknowledgementKey, 'true')
    } catch {
      // The notice remains available next launch when storage is unavailable.
    }
    setIsRequired(false)
    setIsOpen(false)
  }, [])
  const openNotice = useCallback(() => {
    setIsRequired(false)
    setIsOpen(true)
  }, [])
  const closeNotice = useCallback(() => {
    if (!isRequired) setIsOpen(false)
  }, [isRequired])

  return { isOpen, isRequired, acknowledge, openNotice, closeNotice }
}
