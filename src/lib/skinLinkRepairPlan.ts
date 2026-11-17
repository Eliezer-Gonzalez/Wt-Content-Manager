import type { LocalLibrary } from './localLibrary'
import type { WtLiveItem } from './wtLive'
import type { SkinFingerprint } from './skinFingerprint'
import type { SkinLinkCandidate } from './skinRepair'

export type ImportAutomaticLink = { recordId: string; sourceFingerprint: SkinFingerprint; item?: WtLiveItem; externalPublication?: NonNullable<LocalLibrary['installedSkins'][number]['externalPublication']> }
export type ImportRepairPlan = { library: LocalLibrary; candidates: SkinLinkCandidate[]; automaticLinks: ImportAutomaticLink[]; autoLinked: number }

export function createImportedLibraryPlan(current: LocalLibrary, imported: LocalLibrary): ImportRepairPlan {
  const favorites = [...current.favorites]
  for (const item of imported.favorites) {
    if (!favorites.some(saved => saved.id === item.id && (saved.contentType ?? 'camouflage') === (item.contentType ?? 'camouflage'))) favorites.push(item)
  }
  const skins = current.installedSkins.map(entry => ({ ...entry }))
  const sources = imported.installedSkins.flatMap(entry => {
    const item = entry.item ?? entry.externalPublication?.item
    return item ? [{ entry, item, externalPublication: entry.item ? undefined : entry.externalPublication }] : []
  })
  const targets = skins.map((entry, index) => ({ entry, index })).filter(({ entry }) => entry.availability === 'present' && !entry.item && !entry.externalPublication)
  const edges = sources.map(source => targets.map(target => ({ target, evidence: compareFingerprints(source.entry.fingerprint, target.entry.fingerprint) })).filter(value => value.evidence !== null))
  const targetDegrees = new Map<number, number>()
  for (const edge of edges) for (const match of edge) targetDegrees.set(match.target.index, (targetDegrees.get(match.target.index) ?? 0) + 1)
  for (const source of sources) {
    for (const target of targets.filter(candidate => candidate.entry.folderName.toLowerCase() === source.entry.folderName.toLowerCase() && (!source.entry.fingerprint || !candidate.entry.fingerprint))) {
      targetDegrees.set(target.index, (targetDegrees.get(target.index) ?? 0) + 1)
    }
  }
  const automatic = new Set<string>()
  const automaticLinks: ImportAutomaticLink[] = []
  let autoLinked = 0
  for (let sourceIndex = 0; sourceIndex < sources.length; sourceIndex++) {
    const full = edges[sourceIndex].filter(match => match.evidence?.full)
    if (sources[sourceIndex].entry.fingerprint?.origin !== 'install' || full.length !== 1 || edges[sourceIndex].length !== 1 || targetDegrees.get(full[0].target.index) !== 1 || full[0].target.entry.fingerprint?.origin !== 'install' || full[0].target.entry.item || full[0].target.entry.externalPublication) continue
    const id = `${sourceIndex}:${full[0].target.index}`
    automatic.add(id)
    automaticLinks.push({ recordId: full[0].target.entry.recordId ?? '', sourceFingerprint: sources[sourceIndex].entry.fingerprint!, item: sources[sourceIndex].externalPublication ? undefined : sources[sourceIndex].item, externalPublication: sources[sourceIndex].externalPublication })
    if (sources[sourceIndex].externalPublication) {
      const link = { ...sources[sourceIndex].externalPublication!, folderPath: full[0].target.entry.path }
      skins[full[0].target.index] = { ...skins[full[0].target.index], externalPublication: link }
    } else {
      skins[full[0].target.index] = { ...skins[full[0].target.index], item: sources[sourceIndex].item }
    }
    autoLinked++
  }
  const candidates: SkinLinkCandidate[] = []
  for (let sourceIndex = 0; sourceIndex < sources.length; sourceIndex++) {
    for (const match of edges[sourceIndex]) {
      const id = `${sourceIndex}:${match.target.index}`
      if (automatic.has(id) || match.target.entry.item) continue
      candidates.push({
        recordId: match.target.entry.recordId ?? '', recordPath: match.target.entry.path, folderName: match.target.entry.folderName, folderPath: match.target.entry.path,
        matchingFiles: match.evidence!.matchingFiles, totalFiles: match.evidence!.totalFiles,
        matchingBytes: match.evidence!.matchingBytes, totalBytes: match.evidence!.totalBytes,
        matchPercent: match.evidence!.percent, reason: match.evidence!.full ? 'ambiguousFull' : 'partial',
        item: sources[sourceIndex].externalPublication ? undefined : sources[sourceIndex].item,
        sourceFingerprint: sources[sourceIndex].entry.fingerprint,
        externalPublication: sources[sourceIndex].externalPublication ? { ...sources[sourceIndex].externalPublication!, folderPath: match.target.entry.path } : undefined,
      })
    }
    const name = sources[sourceIndex].entry.folderName.toLowerCase()
    for (const target of targets) {
      if (target.entry.item || target.entry.folderName.toLowerCase() !== name || (sources[sourceIndex].entry.fingerprint && target.entry.fingerprint)) continue
      candidates.push({ recordId: target.entry.recordId ?? '', recordPath: target.entry.path, folderName: target.entry.folderName, folderPath: target.entry.path, matchingFiles: 0, totalFiles: 0, matchingBytes: 0, totalBytes: 0, matchPercent: 0, reason: 'nameOnly', item: sources[sourceIndex].externalPublication ? undefined : sources[sourceIndex].item, externalPublication: sources[sourceIndex].externalPublication ? { ...sources[sourceIndex].externalPublication!, folderPath: target.entry.path } : undefined })
    }
  }
  const externalSkinPublications = [...current.externalSkinPublications]
  for (const entry of skins) {
    if (!entry.externalPublication || externalSkinPublications.some(link => link.folderPath.toLowerCase() === entry.path.toLowerCase())) continue
    externalSkinPublications.push(entry.externalPublication)
  }
  return { library: { ...current, favorites, installedSkins: skins, externalSkinPublications, repairRevision: current.repairRevision ?? 0 }, candidates, automaticLinks, autoLinked }
}

function compareFingerprints(saved?: SkinFingerprint, current?: SkinFingerprint) {
  if (!saved || !current) return null
  const right = new Map(current.files.map(file => [file.relativePath, file]))
  let matchingFiles = 0
  let matchingBytes = 0
  for (const file of saved.files) {
    const other = right.get(file.relativePath)
    if (other && other.sizeBytes === file.sizeBytes && other.hash === file.hash) { matchingFiles++; matchingBytes += file.sizeBytes }
  }
  const full = saved.globalHash === current.globalHash && matchingFiles === saved.files.length && matchingFiles === current.files.length
  if (!full && matchingFiles === 0) return null
  const totalFiles = Math.max(saved.files.length, current.files.length)
  const savedBytes = saved.files.reduce((sum, file) => sum + file.sizeBytes, 0)
  const currentBytes = current.files.reduce((sum, file) => sum + file.sizeBytes, 0)
  const totalBytes = Math.max(savedBytes, currentBytes)
  const fileRatio = totalFiles === 0 ? 1 : matchingFiles / totalFiles
  const byteRatio = totalBytes === 0 ? fileRatio : matchingBytes / totalBytes
  return { full, matchingFiles, matchingBytes, totalFiles, totalBytes, percent: Math.round((fileRatio + byteRatio) * 50) }
}
