import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'

import { addScriptHashPolicy } from '../src/csp/script-hashes.ts'

// Runs after `next build` and before the service worker build, which records
// each file's revision: adds the inline-script hash policy to every page in out/.
const pages = readdirSync('out', { recursive: true, encoding: 'utf8' }).filter((file) =>
  file.endsWith('.html'),
)
if (pages.length === 0) throw new Error('No pages in out/; run `next build` first')
for (const page of pages) {
  const file = path.join('out', page)
  writeFileSync(file, addScriptHashPolicy(readFileSync(file, 'utf8')))
}
