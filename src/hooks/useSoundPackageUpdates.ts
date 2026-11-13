import { useCallback, useEffect, useRef, useState } from 'react'
import { fetchLinkedPost } from '../lib/wtLive'
import type { SoundPackage } from '../lib/sounds'

const storageKey = 'wt-content-manager-sound-package-updates'
const automaticCheckIntervalMs = 24 * 60 * 60 * 1000
const maxConcurrentChecks = 2

export type SoundPackageUpdateResult = {
  status: 'possible' | 'no-change' | 'unavailable' | 'downloaded'
  revision: number
  remoteArchiveName?: string
  checkedAt: number
}

type UpdateCache = {
  lastCheckedAt: number | null
  results: Record<string, SoundPackageUpdateResult>
}

function validTimestamp(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= Math.min(8.64e15, Date.now() + automaticCheckIntervalMs)
}

function validResult(value: unknown): value is SoundPackageUpdateResult {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const result = value as Partial<SoundPackageUpdateResult>
  return (result.status === 'possible' || result.status === 'no-change' || result.status === 'unavailable' || result.status === 'downloaded') &&
    typeof result.revision === 'number' && Number.isSafeInteger(result.revision) && result.revision >= 0 &&
    validTimestamp(result.checkedAt) &&
    (result.remoteArchiveName === undefined || (typeof result.remoteArchiveName === 'string' && result.remoteArchiveName.length <= 256))
}

export type SoundPackageUpdateController = {
  results: Record<string, SoundPackageUpdateResult>
  checking: boolean
  completed: number
  total: number
  lastCheckedAt: number | null
  refresh: () => Promise<void>
  markDownloaded: (packageId: string, revision: number, archiveName: string) => void
}

function readCache(): UpdateCache {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(storageKey) ?? 'null')
    if (!saved || typeof saved !== 'object' || Array.isArray(saved)) return { lastCheckedAt: null, results: {} }
    const cache = saved as Partial<UpdateCache>
    const validResults = cache.results && typeof cache.results === 'object' && !Array.isArray(cache.results)
      ? Object.fromEntries(Object.entries(cache.results).filter((entry): entry is [string, SoundPackageUpdateResult] => validResult(entry[1])))
      : {}
    return {
      lastCheckedAt: validTimestamp(cache.lastCheckedAt) ? cache.lastCheckedAt : null,
      results: validResults,
    }
  } catch {
    return { lastCheckedAt: null, results: {} }
  }
}

function writeCache(cache: UpdateCache) {
  try { localStorage.setItem(storageKey, JSON.stringify(cache)) } catch { /* Update status is a convenience only. */ }
}

function normalizeFileName(value?: string) {
  const basename = value?.split(/[\\/]/).pop()?.trim() ?? ''
  return basename.replace(/[<>:"\\|?*\u0000-\u001f]/g, '_').slice(0, 160).toLocaleLowerCase('en-US')
}

export function useSoundPackageUpdates(packages: SoundPackage[], enabled: boolean): SoundPackageUpdateController {
  const [cache, setCache] = useState<UpdateCache>(readCache)
  const [checking, setChecking] = useState(false)
  const [completed, setCompleted] = useState(0)
  const [total, setTotal] = useState(0)
  const inFlightRef = useRef(false)
  const cacheRef = useRef(cache)
  const packagesRef = useRef(packages)
  cacheRef.current = cache
  packagesRef.current = packages

  const refresh = useCallback(async (force = true) => {
    if (inFlightRef.current || packages.length === 0) return
    const now = Date.now()
    const targets = force
      ? packages
      : packages.filter(packageInfo => {
          const result = cacheRef.current.results[packageInfo.id]
          return result?.revision !== packageInfo.revision || now - (result?.checkedAt ?? 0) >= automaticCheckIntervalMs
        })
    if (targets.length === 0) return

    inFlightRef.current = true
    setChecking(true)
    setCompleted(0)
    const groups = [...new Set(targets.map(packageInfo => packageInfo.langGroup))]
    setTotal(groups.length)
    const latestByGroup = new Map<number, { name?: string; available: boolean }>()
    let nextGroupIndex = 0

    const worker = async () => {
      while (nextGroupIndex < groups.length) {
        const group = groups[nextGroupIndex++]
        try {
          const post = await fetchLinkedPost(group, 'en')
          latestByGroup.set(group, { name: post.item.fileName, available: Boolean(post.item.fileName) })
        } catch {
          latestByGroup.set(group, { available: false })
        }
        setCompleted(value => value + 1)
      }
    }

    try {
      await Promise.all(Array.from({ length: Math.min(maxConcurrentChecks, groups.length) }, () => worker()))
      const checkedAt = Date.now()
      const currentPackages = packagesRef.current
      const packageIds = new Set(currentPackages.map(packageInfo => packageInfo.id))
      const retainedResults = Object.fromEntries(Object.entries(cacheRef.current.results)
        .filter(([packageId]) => packageIds.has(packageId)))
      const nextCache: UpdateCache = { ...cacheRef.current, lastCheckedAt: checkedAt, results: retainedResults }
      const checkedGroups = new Set(groups)
      for (const checkedPackage of targets) {
        const packageInfo = currentPackages.find(candidate => candidate.id === checkedPackage.id)
        if (!packageInfo || packageInfo.revision !== checkedPackage.revision) continue
        if (!checkedGroups.has(packageInfo.langGroup)) continue
        const latest = latestByGroup.get(packageInfo.langGroup)
        const sameName = latest?.available && normalizeFileName(latest.name) === normalizeFileName(packageInfo.archiveName)
        nextCache.results[packageInfo.id] = {
          status: !latest?.available ? 'unavailable' : sameName ? 'no-change' : 'possible',
          revision: packageInfo.revision,
          remoteArchiveName: latest?.name,
          checkedAt,
        }
      }
      cacheRef.current = nextCache
      setCache(nextCache)
      writeCache(nextCache)
    } finally {
      inFlightRef.current = false
      setChecking(false)
    }
  }, [packages])

  const markDownloaded = useCallback((packageId: string, revision: number, archiveName: string) => {
    packagesRef.current = packagesRef.current.map(packageInfo =>
      packageInfo.id === packageId ? { ...packageInfo, revision, archiveName } : packageInfo,
    )
    const nextCache: UpdateCache = {
      ...cacheRef.current,
      results: {
        ...cacheRef.current.results,
        [packageId]: { status: 'downloaded', revision, remoteArchiveName: archiveName, checkedAt: Date.now() },
      },
    }
    cacheRef.current = nextCache
    setCache(nextCache)
    writeCache(nextCache)
  }, [])

  useEffect(() => {
    if (enabled) void refresh(false)
  }, [enabled, refresh, checking])

  return { ...cache, checking, completed, total, refresh: () => refresh(true), markDownloaded }
}
