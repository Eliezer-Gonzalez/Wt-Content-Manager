export type SkinFingerprint = {
  files: { relativePath: string; sizeBytes: number; hash: string }[]
  globalHash: string
  origin: 'install' | 'baseline'
}

const pathEncoder = new TextEncoder()

export function parseStoredSkinFingerprint(value: unknown): SkinFingerprint | undefined {
  if (!value || typeof value !== 'object') return undefined
  const candidate = value as Partial<SkinFingerprint>
  if (typeof candidate.globalHash !== 'string' || !/^[\da-f]{64}$/i.test(candidate.globalHash) || !Array.isArray(candidate.files)) return undefined
  const files = candidate.files.flatMap(file => {
    if (!file || typeof file !== 'object') return []
    const saved = file as { relativePath?: unknown; sizeBytes?: unknown; hash?: unknown }
    if (typeof saved.relativePath !== 'string' || !saved.relativePath || saved.relativePath.startsWith('/')
      || saved.relativePath.split('/').some(part => !part || part === '.' || part === '..')
      || !Number.isSafeInteger(saved.sizeBytes) || (saved.sizeBytes as number) < 0
      || typeof saved.hash !== 'string' || !/^[\da-f]{64}$/i.test(saved.hash)) return []
    return [{ relativePath: saved.relativePath, sizeBytes: saved.sizeBytes as number, hash: saved.hash }]
  })
  if (files.length !== candidate.files.length || files.some((file, index) => index > 0 && comparePathBytes(files[index - 1].relativePath, file.relativePath) >= 0)) return undefined
  return { files, globalHash: candidate.globalHash, origin: candidate.origin === 'baseline' ? 'baseline' : 'install' }
}

function comparePathBytes(left: string, right: string): number {
  const leftBytes = pathEncoder.encode(left)
  const rightBytes = pathEncoder.encode(right)
  for (let index = 0; index < Math.min(leftBytes.length, rightBytes.length); index++) {
    if (leftBytes[index] !== rightBytes[index]) return leftBytes[index] - rightBytes[index]
  }
  return leftBytes.length - rightBytes.length
}
