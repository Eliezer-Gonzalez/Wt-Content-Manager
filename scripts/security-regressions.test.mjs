import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'
import test from 'node:test'

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8')

async function listSourceFiles(directory, prefix = '') {
  const entries = await readdir(directory, { withFileTypes: true })
  const nested = await Promise.all(entries.map(entry => {
    const path = `${prefix}${entry.name}`
    return entry.isDirectory()
      ? listSourceFiles(new URL(`${entry.name}/`, directory), `${path}/`)
      : [path]
  }))
  return nested.flat()
}

test('startup fonts are local and the legal notice gates the WT Live feed', async () => {
  const [styles, app, config] = await Promise.all([
    read('src/styles.css'),
    read('src/App.tsx'),
    read('src-tauri/tauri.conf.json'),
  ])
  assert.doesNotMatch(styles, /fonts\.googleapis\.com|fonts\.gstatic\.com/i)
  assert.match(styles, /@fontsource\/barlow-condensed/)
  assert.match(styles, /@fontsource\/dm-sans/)
  assert.match(app, /useCamouflageFeed\(\{\s*enabled:\s*feedEnabled\s*&&\s*!legalNotice\.isRequired/)
  assert.doesNotMatch(config, /fonts\.googleapis\.com|fonts\.gstatic\.com/i)
})

test('every app external URL is covered by a narrow Tauri opener permission', async () => {
  const [capability, appInfo, postActions, detailDialog, wtLive, externalLinks, descriptionLinks] = await Promise.all([
    read('src-tauri/capabilities/default.json').then(JSON.parse),
    read('src/lib/appInfo.ts'),
    read('src/components/PostInstallActions.tsx'),
    read('src/components/PostDetailDialog.tsx'),
    read('src/lib/wtLive.ts'),
    read('src-tauri/src/external_links.rs'),
    read('src/components/WtLiveDescriptionText.tsx'),
  ])
  const opener = capability.permissions.find(permission => typeof permission === 'object' && permission.identifier === 'opener:allow-open-url')
  assert.ok(opener, 'the app must declare opener URL rules')
  const allowed = opener.allow.map(rule => rule.url)
  assert.deepEqual(allowed.sort(), [
    'https://github.com/Eliezer-Gonzalez/Wt-Content-Manager',
    'https://github.com/Eliezer-Gonzalez/Wt-Content-Manager/**',
    'https://live.warthunder.com/**',
    'https://wiki.warthunder.com/cdk/creation_camo',
  ].sort(), 'external URL permissions must stay limited to app openers')
  const matchesPermission = url => allowed.some(pattern => pattern.endsWith('/**')
    ? url.startsWith(pattern.slice(0, -2))
    : url === pattern)

  const repositoryMatch = appInfo.match(/APP_REPOSITORY_URL\s*=\s*'([^']+)'/)
  assert.ok(repositoryMatch, 'repository opener URL must stay explicit')
  const repositoryUrl = repositoryMatch[1]
  assert.match(appInfo, /APP_LICENSE_URL\s*=\s*`\$\{APP_REPOSITORY_URL\}\/blob\/main\/LICENSE`/)
  assert.match(appInfo, /THIRD_PARTY_NOTICES_URL\s*=\s*`\$\{APP_REPOSITORY_URL\}\/blob\/main\/THIRD_PARTY_NOTICES\.md`/)
  const staticTargets = [
    'https://wiki.warthunder.com/cdk/creation_camo',
    'https://live.warthunder.com/rules/',
    repositoryUrl,
    `${repositoryUrl}/blob/main/LICENSE`,
    `${repositoryUrl}/blob/main/THIRD_PARTY_NOTICES.md`,
  ]
  for (const url of staticTargets) assert.ok(matchesPermission(url), `missing opener permission for ${url}`)

  assert.match(postActions, /openReference\('https:\/\/live\.warthunder\.com\/rules\/'\)/)
  assert.match(postActions, /openReference\('https:\/\/wiki\.warthunder\.com\/cdk\/creation_camo'\)/)
  assert.match(detailDialog, /openUrl\(safeUrl\)/)
  assert.match(wtLive, /url\.origin !== 'https:\/\/live\.warthunder\.com'/)
  assert.match(wtLive, /!url\.pathname\.startsWith\('\/post\/'\)/)
  assert.ok(matchesPermission('https://live.warthunder.com/post/123/en/#comments'), 'sanitized dynamic WT Live comment links must be allowed')
  assert.match(wtLive, /getWtLivePostReference/)
  assert.match(descriptionLinks, /getSafeExternalHttpsUrl\(url\)/)
  assert.match(descriptionLinks, /invoke\('open_external_https_url'/)
  assert.match(externalLinks, /url\.scheme\(\) != "https"/)
  assert.match(externalLinks, /url\.username\(\)/)

  const sourceFiles = await listSourceFiles(new URL('../src/', import.meta.url))
  const externalOpenFiles = []
  for (const file of sourceFiles.filter(file => /\.(ts|tsx)$/.test(file))) {
    const source = await read(`src/${file}`)
    if (/\b(?:openUrl|window\.open)\s*\(/.test(source)) externalOpenFiles.push(file)
  }
  assert.deepEqual(externalOpenFiles.sort(), [
    'components/PostDetailDialog.tsx',
    'components/PostInstallActions.tsx',
    'components/SettingsAboutCard.tsx',
    'components/SoundPostDetailDialog.tsx',
    'components/WtLiveDescriptionText.tsx',
  ], 'review every new external URL opener call site in this allowlist test')
  const openerCalls = new Map([
    ['components/PostDetailDialog.tsx', 2],
    ['components/PostInstallActions.tsx', 2],
    ['components/SettingsAboutCard.tsx', 2],
    ['components/SoundPostDetailDialog.tsx', 2],
    ['components/WtLiveDescriptionText.tsx', 1],
  ])
  for (const file of externalOpenFiles) {
    const source = await read(`src/${file}`)
    assert.equal((source.match(/\bopenUrl\s*\(/g) ?? []).length + (source.match(/\bwindow\.open\s*\(/g) ?? []).length, openerCalls.get(file), `review new external open calls in ${file}`)
  }
  assert.ok(postActions.includes('openUrl(url)'))
  assert.ok(detailDialog.includes('openUrl(safeUrl)'))
  assert.ok(!allowed.includes('https://wiki.warthunder.com/**'), 'the wiki must remain exact-match only')
})

test('the first-run image-quality choice is local, configurable, and gates startup requests', async () => {
  const [app, settings, gallery, preference] = await Promise.all([
    read('src/App.tsx'),
    read('src/components/SettingsPage.tsx'),
    read('src/components/PostGallery.tsx'),
    read('src/hooks/useImageQualityPreference.ts'),
  ])
  assert.match(app, /enabled:\s*feedEnabled\s*&&\s*!legalNotice\.isRequired\s*&&\s*!imageQuality\.isSetupRequired/)
  assert.match(settings, /ImageQualitySettingsCard/)
  assert.match(gallery, /imageSourceForQuality\(activeImage\.src, activeImage\.fullResolutionSrc, quality\)/)
  assert.match(preference, /localStorage\.setItem\(storageKey, quality\)/)
  assert.match(preference, /isSetupRequired:\s*storedQuality === null/)
})
