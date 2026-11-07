import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const localesDir = path.resolve(__dirname, '../src/i18n/locales')
const enPath = path.join(localesDir, 'en.json')

if (!fs.existsSync(enPath)) {
  console.error(`Base locale en.json not found at ${enPath}`)
  process.exit(1)
}

const VALID_PLURAL_SUFFIXES = new Set(['zero', 'one', 'two', 'few', 'many', 'other'])

function extractPlaceholders(text) {
  if (typeof text !== 'string') return new Set()
  const matches = text.match(/\{([a-zA-Z0-9_]+)\}/g) || []
  return new Set(matches.map(m => m.slice(1, -1)))
}

function setsEqual(a, b) {
  if (a.size !== b.size) return false
  for (const item of a) {
    if (!b.has(item)) return false
  }
  return true
}

const enRaw = fs.readFileSync(enPath, 'utf8')
const en = JSON.parse(enRaw)
const enKeys = new Set(Object.keys(en))

// Identify plural groups in en.json (base keys that have an _other variant)
const enPluralGroups = new Set()
for (const key of enKeys) {
  for (const suffix of VALID_PLURAL_SUFFIXES) {
    if (key.endsWith(`_${suffix}`)) {
      const base = key.slice(0, -(suffix.length + 1))
      if (enKeys.has(`${base}_other`)) {
        enPluralGroups.add(base)
      }
    }
  }
}

let totalErrors = 0
let totalWarnings = 0

const files = fs.readdirSync(localesDir).filter(f => f.endsWith('.json'))

for (const file of files) {
  const filePath = path.join(localesDir, file)
  const isEn = file === 'en.json'
  const localeName = path.basename(file, '.json')
  const content = JSON.parse(fs.readFileSync(filePath, 'utf8'))
  const keys = Object.keys(content)
  const keySet = new Set(keys)

  console.log(`\nChecking locale: ${file}`)
  let fileErrors = 0
  let fileWarnings = 0

  // 1. Check plural groups defined in this file
  const localPluralBases = new Map() // base -> array of suffixes
  for (const key of keys) {
    const underscoreIndex = key.lastIndexOf('_')
    if (underscoreIndex !== -1) {
      const potentialBase = key.slice(0, underscoreIndex)
      const suffix = key.slice(underscoreIndex + 1)

      if (enPluralGroups.has(potentialBase)) {
        if (!VALID_PLURAL_SUFFIXES.has(suffix)) {
          console.error(`  [ERROR] Invalid plural suffix "_${suffix}" in key "${key}". Allowed: ${[...VALID_PLURAL_SUFFIXES].join(', ')}`)
          fileErrors++
        } else {
          if (!localPluralBases.has(potentialBase)) localPluralBases.set(potentialBase, [])
          localPluralBases.get(potentialBase).push(suffix)
        }
      }
    }
  }

  // Every plural group present in this file must have an _other variant
  for (const [base, suffixes] of localPluralBases.entries()) {
    if (!suffixes.includes('other')) {
      console.error(`  [ERROR] Plural group "${base}" is missing required "_other" variant in ${file}`)
      fileErrors++
    }
  }

  if (!isEn) {
    // 2. Missing keys in locale: WARNING
    for (const enKey of enKeys) {
      if (!keySet.has(enKey)) {
        // If it's a plural key and the locale defined an _other variant, that's already checked
        console.warn(`  [WARNING] Missing key in ${file}: "${enKey}" (will fall back to English)`)
        fileWarnings++
      }
    }

    // 3. Extra keys not present in en.json: ERROR
    for (const locKey of keys) {
      if (!enKeys.has(locKey)) {
        // Check if it's a valid CLDR plural variant for a known plural group
        let isKnownPluralVariant = false
        const underscoreIndex = locKey.lastIndexOf('_')
        if (underscoreIndex !== -1) {
          const potentialBase = locKey.slice(0, underscoreIndex)
          const suffix = locKey.slice(underscoreIndex + 1)
          if (enPluralGroups.has(potentialBase) && VALID_PLURAL_SUFFIXES.has(suffix)) {
            isKnownPluralVariant = true
          }
        }

        if (!isKnownPluralVariant) {
          console.error(`  [ERROR] Extra key not present in en.json: "${locKey}"`)
          fileErrors++
        }
      }
    }

    // 4. Placeholder mismatch: ERROR
    for (const locKey of keys) {
      let referenceText = en[locKey]
      if (referenceText === undefined) {
        // Maybe it's a valid plural variant (e.g. posts_few), compare with base_other
        const underscoreIndex = locKey.lastIndexOf('_')
        if (underscoreIndex !== -1) {
          const potentialBase = locKey.slice(0, underscoreIndex)
          referenceText = en[`${potentialBase}_other`]
        }
      }

      if (typeof referenceText === 'string') {
        const enPlaceholders = extractPlaceholders(referenceText)
        const locPlaceholders = extractPlaceholders(content[locKey])
        if (!setsEqual(enPlaceholders, locPlaceholders)) {
          const expected = [...enPlaceholders].join(', ') || 'none'
          const actual = [...locPlaceholders].join(', ') || 'none'
          console.error(`  [ERROR] Placeholder mismatch for key "${locKey}": expected {${expected}}, got {${actual}}`)
          fileErrors++
        }
      }
    }
  }

  if (fileErrors === 0 && fileWarnings === 0) {
    console.log(`  ✓ All keys valid and synchronized.`)
  }

  totalErrors += fileErrors
  totalWarnings += fileWarnings
}

console.log(`\nLocale verification complete: ${totalErrors} error(s), ${totalWarnings} warning(s).`)

if (totalErrors > 0) {
  process.exit(1)
} else {
  process.exit(0)
}
