'use client'

// Developer reference for the design tokens and motion presets. Built only
// for `next dev` and the dev deploy (see next.config.ts); its labels are token
// names for developers, so they are not in the i18n catalogues.

import { motion } from 'motion/react'
import type { Transition } from 'motion/react'
import { useState, useSyncExternalStore } from 'react'
import type { ReactNode } from 'react'

import { fade, pop, soft, std } from '@/ui/motion'
import { Pressable } from '@/ui/pressable'

const colours = [
  'bg',
  'surface',
  'sunk',
  'ink',
  'ink-2',
  'ink-3',
  'line',
  'accent',
  'accent-ink',
  'accent-wash',
  'short',
  'short-wash',
  'scrim',
  'chalk',
] as const

const spaces = ['w-4', 'w-8', 'w-12', 'w-16', 'w-20', 'w-28', 'w-40'] as const

const radii = [
  ['ctl', 'rounded-ctl'],
  ['group', 'rounded-group'],
  ['media', 'rounded-media'],
  ['sheet', 'rounded-sheet'],
  ['full', 'rounded-full'],
] as const

const presets: readonly (readonly [string, Transition])[] = [
  ['std', std],
  ['pop', pop],
  ['soft', soft],
]

type Theme = 'system' | 'light' | 'dark'

const reducedMotionQuery = '(prefers-reduced-motion: reduce)'

function subscribeToReducedMotion(onChange: () => void) {
  const query = matchMedia(reducedMotionQuery)
  query.addEventListener('change', onChange)
  return () => {
    query.removeEventListener('change', onChange)
  }
}

// The prerendered HTML says "off"; the client corrects it after hydration.
function useReducedMotionSetting(): boolean {
  return useSyncExternalStore(
    subscribeToReducedMotion,
    () => matchMedia(reducedMotionQuery).matches,
    () => false,
  )
}

function applyTheme(theme: Theme) {
  if (theme === 'system') {
    delete document.documentElement.dataset.theme
  } else {
    document.documentElement.dataset.theme = theme
  }
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-12">
      <h2 className="text-section">{title}</h2>
      <div className="rounded-group bg-surface p-16">{children}</div>
    </section>
  )
}

export default function KitchenSinkPage() {
  const [theme, setTheme] = useState<Theme>('system')
  const [moved, setMoved] = useState(false)
  const [shown, setShown] = useState(true)
  const reduced = useReducedMotionSetting()

  return (
    <main className="mx-auto flex max-w-lg flex-col gap-28 px-20 py-40">
      <header className="flex flex-col gap-8">
        <h1 className="text-title">Kitchen sink</h1>
        <p className="text-label text-ink-2">
          Reduce Motion: <span className="num">{reduced ? 'on' : 'off'}</span>
        </p>
        <div className="flex gap-8" role="group" aria-label="Theme">
          {(['system', 'light', 'dark'] as const).map((value) => (
            <Pressable
              key={value}
              aria-pressed={theme === value}
              onClick={() => {
                setTheme(value)
                applyTheme(value)
              }}
              className={`rounded-full px-16 py-12 text-label ${
                theme === value ? 'bg-ink text-bg' : 'bg-sunk text-ink'
              }`}
            >
              {value}
            </Pressable>
          ))}
        </div>
      </header>

      <Section title="Colour">
        <ul className="grid grid-cols-2 gap-12">
          {colours.map((name) => (
            <li key={name} className="flex items-center gap-12">
              <span
                className="size-40 rounded-ctl border border-line"
                style={{ background: `var(--${name})` }}
              />
              <code className="num text-label text-ink-2">--{name}</code>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Type">
        <div className="flex flex-col gap-12">
          <p className="text-title">Title 30 / 650</p>
          <p className="text-section">Section 24 / 650</p>
          <p className="text-body">Body 15 / 400 · 杠铃卧推</p>
          <p className="text-label text-ink-2">Label 13 / 500</p>
          <p className="num text-title font-normal">62.5 kg · 1,284</p>
        </div>
      </Section>

      <Section title="Spacing and radius">
        <div className="flex flex-col gap-8">
          {spaces.map((width) => (
            <div key={width} className="flex items-center gap-12">
              <span className={`h-12 bg-accent ${width}`} />
              <code className="num text-label text-ink-2">{width.slice(2)}</code>
            </div>
          ))}
        </div>
        <div className="mt-20 flex flex-wrap gap-12">
          {radii.map(([name, className]) => (
            <div key={name} className="flex flex-col items-center gap-4">
              <span className={`size-40 bg-sunk ${className}`} />
              <code className="num text-label text-ink-2">{name}</code>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Press">
        <div className="flex flex-wrap gap-12">
          <Pressable className="rounded-full bg-accent px-20 py-12 font-semibold text-accent-ink">
            Primary
          </Pressable>
          <Pressable className="rounded-full bg-sunk px-20 py-12 font-semibold text-ink">
            Ghost
          </Pressable>
        </div>
      </Section>

      <Section title="Springs">
        <div className="flex flex-col gap-16">
          {presets.map(([name, transition]) => (
            <div key={name} className="flex items-center gap-12">
              <code className="num w-40 text-label text-ink-2">{name}</code>
              <div className="relative h-28 flex-1 rounded-full bg-sunk">
                <motion.span
                  className="absolute top-4 left-4 size-20 rounded-full bg-accent"
                  animate={{ x: moved ? 200 : 0 }}
                  transition={transition}
                />
              </div>
            </div>
          ))}
          <div className="flex items-center gap-12">
            <code className="num w-40 text-label text-ink-2">fade</code>
            <motion.span
              className="size-28 rounded-ctl bg-short"
              animate={{ opacity: shown ? 1 : 0 }}
              transition={fade}
            />
          </div>
          <Pressable
            className="self-start rounded-full bg-ink px-20 py-12 font-semibold text-bg"
            onClick={() => {
              setMoved((value) => !value)
              setShown((value) => !value)
            }}
          >
            Play
          </Pressable>
        </div>
      </Section>
    </main>
  )
}
