import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8')

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

test('the texture help link has only its exact wiki URL opener permission', async () => {
  const [capability, component] = await Promise.all([
    read('src-tauri/capabilities/default.json'),
    read('src/components/PostInstallActions.tsx'),
  ])
  const url = 'https://wiki.warthunder.com/cdk/creation_camo'
  assert.match(component, new RegExp(url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
  assert.ok(capability.includes(`"url": "${url}"`))
  assert.ok(!capability.includes('https://wiki.warthunder.com/**'))
})
