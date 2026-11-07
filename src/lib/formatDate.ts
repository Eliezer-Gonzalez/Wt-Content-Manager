export function relativeDate(timestamp: number, locale: string) {
  const seconds = Math.max(0, Math.floor(Date.now() / 1000 - timestamp))
  if (seconds < 3600) return locale === 'es' ? `Hace ${Math.max(1, Math.floor(seconds / 60))} min` : `${Math.max(1, Math.floor(seconds / 60))} min ago`
  if (seconds < 86400) return locale === 'es' ? `Hace ${Math.floor(seconds / 3600)} h` : `${Math.floor(seconds / 3600)} h ago`
  return new Date(timestamp * 1000).toLocaleDateString(locale === 'es' ? 'es-CL' : 'en-US', { day: 'numeric', month: 'short' })
}
