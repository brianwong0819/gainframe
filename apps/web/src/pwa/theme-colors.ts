import { readFileSync } from 'node:fs'
import path from 'node:path'

// Colours that leave CSS (the web app manifest, <meta name="theme-color"> and
// the generated icons and splash screens) are read from tokens.css at build
// time, so tokens.css stays the only place a raw colour is written.

export interface SchemeColors {
  bg: string
  ink: string
  accent: string
}

export interface ThemeColors {
  light: SchemeColors
  dark: SchemeColors
}

function readBlock(css: string, selector: string): SchemeColors {
  const start = css.indexOf(`${selector} {`)
  if (start === -1) throw new Error(`tokens.css has no "${selector}" block`)
  const block = css.slice(start, css.indexOf('}', start))
  const read = (name: string): string => {
    const value = new RegExp(`--${name}:\\s*(#[0-9a-f]{6});`).exec(block)?.[1]
    if (value === undefined) throw new Error(`"${selector}" in tokens.css has no hex --${name}`)
    return value
  }
  return { bg: read('bg'), ink: read('ink'), accent: read('accent') }
}

export function parseThemeColors(css: string): ThemeColors {
  return {
    light: readBlock(css, ':root'),
    dark: readBlock(css, ":root[data-theme='dark']"),
  }
}

// Build-time only: `next build`, `next dev` and scripts/ run from apps/web.
export function loadThemeColors(): ThemeColors {
  return parseThemeColors(readFileSync(path.join(process.cwd(), 'src/styles/tokens.css'), 'utf8'))
}
