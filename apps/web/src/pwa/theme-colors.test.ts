import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { parseThemeColors } from './theme-colors.ts'

describe('parseThemeColors', () => {
  it('reads the light and forced-dark colours from tokens.css', () => {
    const css = readFileSync(new URL('../styles/tokens.css', import.meta.url), 'utf8')
    expect(parseThemeColors(css)).toEqual({
      light: { bg: '#eeefeb', ink: '#0d0f11', accent: '#2340e0' },
      dark: { bg: '#0a0b0d', ink: '#f0f1ee', accent: '#7389ff' },
    })
  })

  it('fails the build when a colour is missing or not a hex value', () => {
    const dark = ":root[data-theme='dark'] { --bg: #000000; --ink: #ffffff; --accent: #0000ff; }"
    expect(() => parseThemeColors(dark)).toThrow('no ":root" block')
    expect(() =>
      parseThemeColors(`:root { --bg: #ffffff; --ink: rgb(0 0 0); --accent: #0000ff; }\n${dark}`),
    ).toThrow('no hex --ink')
  })
})
