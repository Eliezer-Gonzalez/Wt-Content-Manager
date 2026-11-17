import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const parserSource = await readFile(new URL('../src/lib/wtLiveParser.ts', import.meta.url), 'utf8')
const tauriConfig = JSON.parse(await readFile(new URL('../src-tauri/tauri.conf.json', import.meta.url), 'utf8'))

test('WT Live description images allow supported Imgur hosts', () => {
  assert.match(parserSource, /url\.hostname === 'imgur\.com'/)
  assert.match(parserSource, /url\.hostname === 'i\.imgur\.com'/)
  assert.match(parserSource, /url\.protocol === 'https:' && trustedImageHost/)
})

test('WT Live description images still reject untrusted or insecure hosts', () => {
  assert.match(parserSource, /url\.hostname\.endsWith\('\.warthunder\.com'\)/)
  assert.doesNotMatch(parserSource, /url\.hostname\.endsWith\('\.imgur\.com'\)/)
  assert.match(tauriConfig.app.security.csp, /img-src[^;]*https:\/\/imgur\.com/)
  assert.match(tauriConfig.app.security.csp, /img-src[^;]*https:\/\/i\.imgur\.com/)
})
