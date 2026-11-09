import { readdirSync, readFileSync } from 'node:fs'
import { join, sep } from 'node:path'

import { describe, expect, it } from 'vitest'

import en from '../../messages/en.json'
import zh from '../../messages/zh.json'

import { detectLocale } from './locale'

/** Every key path in a catalogue, such as `tabs.today`. */
function keys(catalogue: object, prefix = ''): string[] {
  return Object.entries(catalogue).flatMap(([key, value]: [string, unknown]) =>
    typeof value === 'object' && value !== null
      ? keys(value, `${prefix}${key}.`)
      : [`${prefix}${key}`],
  )
}

const src = join(import.meta.dirname, '..')
// Developer pages and their helpers are English-only tools outside the catalogues.
const appFiles = readdirSync(src, { recursive: true, encoding: 'utf8' }).filter(
  (file) =>
    /\.tsx?$/.test(file) && !/\.(dev|test)\.tsx?$/.test(file) && !file.split(sep).includes('dev'),
)
const han = /\p{Script=Han}/u

describe('message catalogues', () => {
  it('have the same keys in Chinese and English', () => {
    expect(keys(zh).sort()).toEqual(keys(en).sort())
  })

  it('leave no Chinese text in the code, so English mode shows none', () => {
    const offenders = appFiles.filter((file) => han.test(readFileSync(join(src, file), 'utf8')))
    expect(offenders).toEqual([])
  })
})

describe('detectLocale', () => {
  it('picks the first device language the app speaks', () => {
    expect(detectLocale(['fr-FR', 'en-GB', 'zh-CN'])).toBe('en')
    expect(detectLocale(['zh-Hant-TW', 'en'])).toBe('zh')
  })

  it('falls back to Chinese', () => {
    expect(detectLocale(['ms-MY'])).toBe('zh')
    expect(detectLocale([])).toBe('zh')
  })
})
