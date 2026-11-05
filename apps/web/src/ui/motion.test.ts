import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { springs } from './motion'

const tokens = readFileSync(new URL('../styles/tokens.css', import.meta.url), 'utf8')

/** Position of a mass-1 damped spring released from 0 towards 1, at time t (s). */
function position(stiffness: number, damping: number, t: number): number {
  const w0 = Math.sqrt(stiffness)
  const zeta = damping / (2 * Math.sqrt(stiffness))
  const wd = w0 * Math.sqrt(1 - zeta * zeta)
  return 1 - Math.exp(-zeta * w0 * t) * (Math.cos(wd * t) + ((zeta * w0) / wd) * Math.sin(wd * t))
}

/** First time after which the spring stays within 0.3% of 1 for 0.4 s. */
function settleTime(stiffness: number, damping: number): number {
  for (let t = 0.05; t < 3; t += 0.005) {
    let settled = true
    for (let s = t; s < t + 0.4; s += 0.01) {
      if (Math.abs(position(stiffness, damping, s) - 1) > 0.003) {
        settled = false
        break
      }
    }
    if (settled) return t
  }
  return 1.5
}

/** The spring as a CSS linear() easing plus its duration, as in the prototype's spring(). */
function cssSpring(stiffness: number, damping: number): { easing: string; durationMs: number } {
  const duration = settleTime(stiffness, damping)
  const segments = 40
  const points = Array.from({ length: segments + 1 }, (_, i) =>
    i === segments ? 1 : Number(position(stiffness, damping, (duration * i) / segments).toFixed(4)),
  )
  return { easing: `linear(${points.join(', ')})`, durationMs: Math.round(duration * 1000) }
}

/** A custom property's value in tokens.css, whitespace collapsed. */
function token(name: string): string {
  const match = new RegExp(`--${name}:\\s*([^;]+);`).exec(tokens)
  if (!match?.[1]) throw new Error(`--${name} is not in tokens.css`)
  return match[1].replace(/\s+/g, ' ').replace('( ', '(').replace(' )', ')')
}

/** The declarations inside the first block that starts after `selector`. */
function block(selector: string): string {
  const start = tokens.indexOf(selector)
  const open = tokens.indexOf('{', start + selector.length)
  const close = tokens.indexOf('}', open)
  return tokens
    .slice(open + 1, close)
    .replace(/\s+/g, ' ')
    .trim()
}

describe('spring tokens', () => {
  it.each(Object.entries(springs))(
    'keeps the CSS %s curve in step with motion.ts',
    (name, { stiffness, damping }) => {
      const expected = cssSpring(stiffness, damping)
      expect(token(`ease-${name}`)).toBe(expected.easing)
      expect(token(`dur-${name}`)).toBe(`${String(expected.durationMs)}ms`)
    },
  )

  it('overshoots for pop and settles without visible overshoot for soft', () => {
    const peak = (stiffness: number, damping: number) =>
      Math.max(...cssSpring(stiffness, damping).easing.slice(7, -1).split(', ').map(Number))
    expect(peak(springs.pop.stiffness, springs.pop.damping)).toBeGreaterThan(1.1)
    expect(peak(springs.soft.stiffness, springs.soft.damping)).toBeLessThanOrEqual(1)
  })
})

describe('dark theme tokens', () => {
  it('are the same for the system setting and for data-theme="dark"', () => {
    const system = block(":root:not([data-theme='light'])")
    const forced = block(":root[data-theme='dark']")
    expect(system).toContain('--bg: #0a0b0d;')
    expect(system).toBe(forced)
  })
})
