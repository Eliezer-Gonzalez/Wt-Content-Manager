const relativeFormatters = new Map<string, Intl.RelativeTimeFormat>()
const dateFormatters = new Map<string, Intl.DateTimeFormat>()
const numberFormatters = new Map<string, Intl.NumberFormat>()

export function getNumberFormatter(locale: string): Intl.NumberFormat {
  let formatter = numberFormatters.get(locale)
  if (!formatter) {
    formatter = new Intl.NumberFormat(locale)
    numberFormatters.set(locale, formatter)
  }
  return formatter
}

export function formatNumber(value: number, locale: string): string {
  return getNumberFormatter(locale).format(value)
}

export function truncateMiddle(value: string, maxLength = 64): string {
  if (value.length <= maxLength) return value
  const available = Math.max(2, maxLength - 1)
  const startLength = Math.ceil(available / 2)
  const endLength = Math.floor(available / 2)
  return `${value.slice(0, startLength)}…${value.slice(-endLength)}`
}

export function relativeDate(timestamp: number, locale: string): string {
  const seconds = Math.max(0, Math.floor(Date.now() / 1000 - timestamp))

  if (seconds < 3600) {
    let rtf = relativeFormatters.get(locale)
    if (!rtf) {
      rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' })
      relativeFormatters.set(locale, rtf)
    }
    const minutes = Math.max(1, Math.floor(seconds / 60))
    return rtf.format(-minutes, 'minute')
  }

  if (seconds < 86400) {
    let rtf = relativeFormatters.get(locale)
    if (!rtf) {
      rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' })
      relativeFormatters.set(locale, rtf)
    }
    const hours = Math.floor(seconds / 3600)
    return rtf.format(-hours, 'hour')
  }

  let dtf = dateFormatters.get(locale)
  if (!dtf) {
    dtf = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short' })
    dateFormatters.set(locale, dtf)
  }
  return dtf.format(new Date(timestamp * 1000))
}

export function formatFileSize(bytes: number, locale: string): string {
  if (bytes === 0) {
    return new Intl.NumberFormat(locale, {
      style: 'unit',
      unit: 'byte',
      unitDisplay: 'short',
      maximumFractionDigits: 0,
    }).format(0)
  }

  if (bytes < 1024) {
    return new Intl.NumberFormat(locale, {
      style: 'unit',
      unit: 'byte',
      unitDisplay: 'short',
      maximumFractionDigits: 0,
    }).format(bytes)
  }

  if (bytes < 1024 * 1024) {
    return new Intl.NumberFormat(locale, {
      style: 'unit',
      unit: 'kilobyte',
      unitDisplay: 'short',
      maximumFractionDigits: 1,
    }).format(bytes / 1024)
  }

  if (bytes < 1024 * 1024 * 1024) {
    return new Intl.NumberFormat(locale, {
      style: 'unit',
      unit: 'megabyte',
      unitDisplay: 'short',
      maximumFractionDigits: 1,
    }).format(bytes / (1024 * 1024))
  }

  return new Intl.NumberFormat(locale, {
    style: 'unit',
    unit: 'gigabyte',
    unitDisplay: 'short',
    maximumFractionDigits: 1,
  }).format(bytes / (1024 * 1024 * 1024))
}
