import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { stripTypeScriptTypes } from 'node:module'
import test from 'node:test'

const source = await readFile(new URL('../src/lib/localLibrary.ts', import.meta.url), 'utf8')
const fingerprintSource = await readFile(new URL('../src/lib/skinFingerprint.ts', import.meta.url), 'utf8')
const repairPlanSource = await readFile(new URL('../src/lib/skinLinkRepairPlan.ts', import.meta.url), 'utf8')
const temporaryDirectory = await mkdtemp(join(tmpdir(), 'wt-local-library-test-'))
const modulePath = join(temporaryDirectory, 'localLibrary.mjs')
await writeFile(join(temporaryDirectory, 'skinFingerprint.mjs'), stripTypeScriptTypes(fingerprintSource, { mode: 'strip' }))
await writeFile(join(temporaryDirectory, 'skinLinkRepairPlan.mjs'), stripTypeScriptTypes(repairPlanSource, { mode: 'strip' }))
const compiled = stripTypeScriptTypes(source.replace("from './skinFingerprint'", "from './skinFingerprint.mjs'"), { mode: 'strip' })
await writeFile(modulePath, compiled)
const { mergeRecoveryReviewRecords, mergeScannedSkins, parseLocalLibrary, removeMissingSkinRecord, sameSkinIdentity } = await import(pathToFileURL(modulePath).href)
const { createImportedLibraryPlan } = await import(pathToFileURL(join(temporaryDirectory, 'skinLinkRepairPlan.mjs')).href)

test.after(async () => rm(temporaryDirectory, { recursive: true, force: true }))

const publication = { id: 42, langGroup: 84, title: 'Test skin', author: 'Author' }
const storedSkin = {
  availability: 'present',
  item: publication,
  folderName: 'Test skin',
  path: 'C:\\War Thunder\\UserSkins\\Test skin',
  fileCount: 2,
  sizeBytes: 128,
  installedAt: '2026-11-17T12:00:00.000Z',
}

test('rescan keeps a missing skin record and its publication link', () => {
  const result = mergeScannedSkins([], [storedSkin])

  assert.equal(result.length, 1)
  assert.equal(result[0].availability, 'missing')
  assert.equal(result[0].item.id, publication.id)
  assert.equal(result[0].folderName, storedSkin.folderName)
})

test('rescan marks a returning skin as present again', () => {
  const result = mergeScannedSkins([{
    folderName: storedSkin.folderName,
    path: storedSkin.path,
    fileCount: 2,
    sizeBytes: 128,
    modifiedAtMs: 1,
  }], [{ ...storedSkin, availability: 'missing' }])

  assert.equal(result.length, 1)
  assert.equal(result[0].availability, 'present')
  assert.equal(result[0].item.id, publication.id)
})

test('rescan preserves the installed skin fingerprint', () => {
  const fingerprint = { files: [{ relativePath: 'skin.blk', sizeBytes: 4, hash: 'a'.repeat(64) }], globalHash: 'b'.repeat(64) }
  const result = mergeScannedSkins([{
    folderName: storedSkin.folderName,
    path: storedSkin.path,
    fileCount: 1,
    sizeBytes: 4,
    modifiedAtMs: 1,
  }], [{ ...storedSkin, fingerprint }])

  assert.deepEqual(result[0].fingerprint, fingerprint)
})

test('fingerprints saved before origin markers load as install-time fingerprints', () => {
  const result = parseLocalLibrary({
    favorites: [],
    installedSkins: [{ ...storedSkin, fingerprint: { files: [{ relativePath: 'skin.blk', sizeBytes: 4, hash: 'a'.repeat(64) }], globalHash: 'b'.repeat(64) } }],
  })

  assert.equal(result.installedSkins[0].fingerprint.origin, 'install')
})

test('same folder names in different game paths remain separate records', () => {
  const otherGameRecord = { ...storedSkin, path: 'D:\\War Thunder\\UserSkins\\Test skin' }
  const result = mergeScannedSkins([{
    folderName: storedSkin.folderName,
    path: otherGameRecord.path,
    fileCount: 3,
    sizeBytes: 256,
    modifiedAtMs: 2,
  }], [storedSkin])

  assert.equal(result.length, 2)
  assert.equal(result.find(entry => entry.path === storedSkin.path).availability, 'missing')
  assert.equal(result.find(entry => entry.path === otherGameRecord.path).availability, 'present')
  assert.equal(sameSkinIdentity(storedSkin, otherGameRecord), false)
})

test('legacy records without availability load as present', () => {
  const result = parseLocalLibrary({
    favorites: [],
    installedSkins: [{ ...storedSkin, availability: undefined }],
  })

  assert.equal(result.installedSkins[0].availability, 'present')
})

test('recovery refresh surfaces review state without losing the known publication link', () => {
  const current = { favorites: [publication], installedSkins: [storedSkin], externalSkinPublications: [] }
  const recovered = { favorites: [], installedSkins: [{ ...storedSkin, availability: 'needsReview', item: undefined }], externalSkinPublications: [] }

  const result = mergeRecoveryReviewRecords(current, recovered)

  assert.equal(result.installedSkins[0].availability, 'needsReview')
  assert.equal(result.installedSkins[0].item.id, publication.id)
  assert.equal(result.favorites.length, 1)
})

test('library import links a unique matching install fingerprint', () => {
  const fingerprint = { origin: 'install', globalHash: 'a'.repeat(64), files: [{ relativePath: 'skin.blk', sizeBytes: 4, hash: 'b'.repeat(64) }] }
  const current = { favorites: [], installedSkins: [{ ...storedSkin, item: undefined, fingerprint }], externalSkinPublications: [], repairRevision: 3 }
  const imported = { favorites: [], installedSkins: [{ ...storedSkin, fingerprint, item: publication }], externalSkinPublications: [], repairRevision: 0 }
  const plan = createImportedLibraryPlan(current, imported)

  assert.equal(plan.autoLinked, 1)
  assert.equal(plan.library.installedSkins[0].item.id, publication.id)
  assert.equal(plan.candidates.length, 0)
})

test('legacy library import with no fingerprints creates candidates only', () => {
  const current = { favorites: [], installedSkins: [{ ...storedSkin, item: undefined }], externalSkinPublications: [], repairRevision: 3 }
  const imported = { favorites: [], installedSkins: [{ ...storedSkin, item: publication, fingerprint: undefined }], externalSkinPublications: [], repairRevision: 0 }
  const plan = createImportedLibraryPlan(current, imported)

  assert.equal(plan.autoLinked, 0)
  assert.equal(plan.library.installedSkins[0].item, undefined)
  assert.equal(plan.candidates.length, 1)
  assert.equal(plan.candidates[0].reason, 'nameOnly')
})

test('baseline fingerprints from an import are candidates and never automatic links', () => {
  const installFingerprint = { origin: 'install', globalHash: 'a'.repeat(64), files: [{ relativePath: 'skin.blk', sizeBytes: 4, hash: 'b'.repeat(64) }] }
  const baselineFingerprint = { ...installFingerprint, origin: 'baseline' }
  const current = { favorites: [], installedSkins: [{ ...storedSkin, item: undefined, fingerprint: baselineFingerprint }], externalSkinPublications: [], repairRevision: 3 }
  const imported = { favorites: [], installedSkins: [{ ...storedSkin, fingerprint: installFingerprint, item: publication }], externalSkinPublications: [], repairRevision: 0 }
  const plan = createImportedLibraryPlan(current, imported)

  assert.equal(plan.autoLinked, 0)
  assert.equal(plan.candidates.length, 1)
  assert.equal(plan.candidates[0].reason, 'ambiguousFull')
})

test('import does not replace a skin that already has an external publication link', () => {
  const fingerprint = { origin: 'install', globalHash: 'a'.repeat(64), files: [{ relativePath: 'skin.blk', sizeBytes: 4, hash: 'b'.repeat(64) }] }
  const externalItem = { ...publication, id: publication.id + 1 }
  const current = { favorites: [], installedSkins: [{ ...storedSkin, item: undefined, externalPublication: { item: externalItem, folderPath: storedSkin.path, confirmedAt: '' }, fingerprint }], externalSkinPublications: [], repairRevision: 3 }
  const imported = { favorites: [], installedSkins: [{ ...storedSkin, fingerprint, item: publication }], externalSkinPublications: [], repairRevision: 0 }
  const plan = createImportedLibraryPlan(current, imported)

  assert.equal(plan.autoLinked, 0)
  assert.equal(plan.library.installedSkins[0].externalPublication.item.id, externalItem.id)
  assert.equal(plan.candidates.length, 0)
})

test('explicitly removing a missing record also removes its external publication link', () => {
  const library = {
    favorites: [publication],
    installedSkins: [{ ...storedSkin, availability: 'missing' }],
    externalSkinPublications: [{ item: publication, confirmedAt: '2026-11-17T12:00:00.000Z', folderPath: storedSkin.path }],
  }

  const result = removeMissingSkinRecord(library, library.installedSkins[0])

  assert.equal(result.installedSkins.length, 0)
  assert.equal(result.externalSkinPublications.length, 0)
  assert.equal(result.favorites.length, 1)
})
