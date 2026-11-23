import { describe, expect, it } from 'vitest'

import { BUILT_IN_EXERCISES } from '../built-in-exercises.ts'
import { searchByName } from './name-search.ts'

const firstName = (query: string) => searchByName(BUILT_IN_EXERCISES, query)[0]?.nameEn

describe('searchByName', () => {
  it('finds bench press by its Chinese and its English name', () => {
    expect(firstName('卧推')).toBe('Barbell bench press')
    expect(firstName('bench')).toBe('Barbell bench press')
  })

  it('ignores case, spaces, punctuation and full-width letters', () => {
    expect(firstName('PUSHUP')).toBe('Push-up')
    expect(firstName('push up')).toBe('Push-up')
    expect(firstName('ｐｕｓｈ－ｕｐ')).toBe('Push-up')
  })

  it('matches aliases', () => {
    expect(firstName('rdl')).toBe('Romanian deadlift')
    expect(firstName('OHP')).toBe('Overhead press')
  })

  it('ranks a name that starts with the query above one that contains it', () => {
    const names = searchByName(BUILT_IN_EXERCISES, '哑铃').map((exercise) => exercise.nameZh)
    expect(names[0]).toBe('哑铃卧推')
    expect(names.indexOf('单臂哑铃划船')).toBeGreaterThan(names.indexOf('哑铃弯举'))
  })

  it('matches every word of a query in any order', () => {
    const names = searchByName(BUILT_IN_EXERCISES, 'curl hammer').map((e) => e.nameEn)
    expect(names).toEqual(['Hammer curl', 'Rope hammer curl'])
  })

  it('searches custom exercises, which have no aliases and may lack a name', () => {
    const custom = [
      { nameZh: null, nameEn: 'Landmine press' },
      { nameZh: '地雷管划船', nameEn: null },
    ]
    expect(searchByName(custom, 'landmine')).toEqual([custom[0]])
    expect(searchByName(custom, '地雷')).toEqual([custom[1]])
  })

  it('returns every exercise in order for a blank query', () => {
    expect(searchByName(BUILT_IN_EXERCISES, '  ')).toEqual(BUILT_IN_EXERCISES)
  })

  it('returns nothing when no exercise matches', () => {
    expect(searchByName(BUILT_IN_EXERCISES, 'zzz')).toEqual([])
  })

  it('ranks an exact name above names that start with it', () => {
    const items = [
      { nameZh: '叉烧包', nameEn: 'Char siew pau' },
      { nameZh: '叉烧', nameEn: 'Char siew' },
    ]
    expect(searchByName(items, '叉烧')[0]).toBe(items[1])
  })
})
