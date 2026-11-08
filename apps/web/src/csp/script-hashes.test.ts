import { createHash } from 'node:crypto'

import { describe, expect, it } from 'vitest'

import { addScriptHashPolicy, inlineScriptHashes } from './script-hashes.ts'

const sha256 = (text: string): string =>
  `'sha256-${createHash('sha256').update(text).digest('base64')}'`

const page = [
  '<!DOCTYPE html><html><head><meta charSet="utf-8"/>',
  '<script src="/_next/static/chunks/a.js" async=""></script>',
  '<script>self.__next_f=[]</script>',
  '</head><body><script id="x">\nself.__next_f.push([1,"a"])\n</script></body></html>',
].join('')

describe('inlineScriptHashes', () => {
  it('hashes the exact text of each inline script and skips external ones', () => {
    expect(inlineScriptHashes(page)).toEqual([
      sha256('self.__next_f=[]'),
      sha256('\nself.__next_f.push([1,"a"])\n'),
    ])
  })
})

describe('addScriptHashPolicy', () => {
  it('puts the policy directly after the charset declaration, before any script', () => {
    const result = addScriptHashPolicy(page)
    const meta = `<meta http-equiv="Content-Security-Policy" content="script-src 'self' ${inlineScriptHashes(page).join(' ')}"/>`
    expect(result).toBe(page.replace('<meta charSet="utf-8"/>', `<meta charSet="utf-8"/>${meta}`))
    expect(result.indexOf(meta)).toBeLessThan(result.indexOf('<script'))
  })

  it('refuses a page without a charset declaration', () => {
    expect(() => addScriptHashPolicy('<html><head></head></html>')).toThrow(/charSet/)
  })

  it('refuses a page that already has a policy, so a rerun cannot stack two', () => {
    expect(() => addScriptHashPolicy(addScriptHashPolicy(page))).toThrow(/already/)
  })
})
