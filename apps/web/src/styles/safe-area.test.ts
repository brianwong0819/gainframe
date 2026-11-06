import { readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

const srcDir = fileURLToPath(new URL('..', import.meta.url))

describe('safe-area insets', () => {
  it('are read from env() only in tokens.css, so the device tests can simulate them', () => {
    const offenders = readdirSync(srcDir, { recursive: true, encoding: 'utf8' })
      .filter((file) => /\.(css|tsx?)$/.test(file) && !file.endsWith('.test.ts'))
      .filter((file) => file !== 'styles/tokens.css' && file !== 'styles\\tokens.css')
      .filter((file) => readFileSync(`${srcDir}/${file}`, 'utf8').includes('safe-area-inset'))

    expect(offenders).toEqual([])
  })
})
