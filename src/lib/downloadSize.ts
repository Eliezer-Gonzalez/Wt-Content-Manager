import { invoke } from '@tauri-apps/api/core'

const maxCachedSizes = 200
const maxConcurrentRequests = 4
const maxQueuedRequests = 16
const sizeCache = new Map<string, number>()
const pendingSizes = new Map<string, Promise<number | null>>()
const waitingRequests: Array<() => void> = []
let activeRequests = 0

async function withRequestSlot<T>(request: () => Promise<T>): Promise<T> {
  if (activeRequests >= maxConcurrentRequests) {
    await new Promise<void>(resolve => waitingRequests.push(resolve))
  } else {
    activeRequests += 1
  }
  try {
    return await request()
  } finally {
    const next = waitingRequests.shift()
    if (next) next()
    else activeRequests -= 1
  }
}

export function getDownloadFileSize(url: string): Promise<number | null> {
  const cached = sizeCache.get(url)
  if (cached !== undefined) {
    sizeCache.delete(url)
    sizeCache.set(url, cached)
    return Promise.resolve(cached)
  }

  const pending = pendingSizes.get(url)
  if (pending) return pending
  if (activeRequests >= maxConcurrentRequests && waitingRequests.length >= maxQueuedRequests) {
    return Promise.resolve(null)
  }

  const request = withRequestSlot(() => invoke<number | null>('get_download_file_size', { url }))
    .then(bytes => {
      if (typeof bytes !== 'number' || !Number.isSafeInteger(bytes) || bytes < 0) return null
      sizeCache.set(url, bytes)
      if (sizeCache.size > maxCachedSizes) {
        const oldest = sizeCache.keys().next().value
        if (oldest !== undefined) sizeCache.delete(oldest)
      }
      return bytes
    })
    .catch(() => null)
    .finally(() => pendingSizes.delete(url))

  pendingSizes.set(url, request)
  return request
}
