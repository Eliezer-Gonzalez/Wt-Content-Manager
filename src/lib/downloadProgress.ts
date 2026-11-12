export function getDownloadPercentage(downloadedBytes: number, totalBytes: number | null): number | null {
  if (!totalBytes) return null
  return Math.min(100, Math.floor(downloadedBytes / totalBytes * 100))
}
