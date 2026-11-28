'use client'

import { type LibraryFood, mealItemSchema, searchByName } from '@gainframe/shared'
import { useLocale, useTranslations } from 'next-intl'
import { useState } from 'react'

import { Pressable } from '@/ui/pressable'
import { Sheet } from '@/ui/sheet'

// Matches listed for a typed name.
const MATCHES_MAX = 5

// What the user picked instead of the estimate's name: a food from the
// library (its figures replace the estimate's), or only a name (the item is
// estimated again by that name; the estimate's figures stay if that fails).
export type Correction = { kind: 'food'; food: LibraryFood } | { kind: 'name'; name: string }

export interface ItemToCorrect {
  name: string
  seen: string
  grams: number
  alternatives: readonly LibraryFood[]
}

const pillClass =
  'flex flex-col items-start rounded-ctl border border-line px-12 py-8 text-left aria-pressed:border-ink aria-pressed:bg-ink aria-pressed:text-bg'

// The sheet a tap on an estimated item's name opens ("Correcting a name" in
// docs/design-system.md): what the model saw, its alternatives with their
// protein for the same weight (first, since the right answer is usually among
// them), a search over the user's foods and the food table, and "remember
// this correction", which sends the correction with later estimates.
export function CorrectionSheet({
  item,
  library,
  onClose,
  onSave,
}: {
  item: ItemToCorrect | null
  library: readonly LibraryFood[]
  onClose: () => void
  onSave: (correction: Correction, remember: boolean) => void
}) {
  const t = useTranslations('estimate')
  const locale = useLocale()
  const whole = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 })
  const [query, setQuery] = useState('')
  const [choice, setChoice] = useState<Correction | null>(null)
  const [remember, setRemember] = useState(true)
  // A new item starts with nothing chosen. The last item stays shown while the
  // sheet closes.
  const [shown, setShown] = useState(item)
  if (item !== null && shown !== item) {
    setShown(item)
    setQuery('')
    setChoice(null)
    setRemember(true)
  }

  const grams = shown?.grams ?? 0
  const typed = query.trim()
  const matches = typed === '' ? [] : searchByName(library, typed).slice(0, MATCHES_MAX)
  const pill = (food: LibraryFood) => (
    <Pressable
      key={food.key}
      aria-pressed={choice?.kind === 'food' && choice.food.key === food.key}
      onClick={() => {
        setChoice({ kind: 'food', food })
      }}
      className={pillClass}
    >
      <span className="text-body">{food.name}</span>
      <span className="num text-label opacity-70">
        {t('protein', { value: whole.format((food.proteinPer100G * grams) / 100) })}
      </span>
    </Pressable>
  )
  const nameOnly = mealItemSchema.shape.name.safeParse(typed).success ? typed : null

  return (
    <Sheet open={item !== null} onClose={onClose} title={t('correctTitle')} closeLabel={t('close')}>
      {shown !== null && (
        <div className="flex flex-col gap-16">
          <p className="text-body text-ink-2">{t('seen', { seen: shown.seen })}</p>
          {shown.alternatives.length > 0 && (
            <section className="flex flex-col gap-8">
              <h3 className="text-label text-ink-3">{t('alternatives')}</h3>
              <div className="flex flex-wrap gap-8">{shown.alternatives.map(pill)}</div>
            </section>
          )}
          <input
            type="search"
            value={query}
            enterKeyHint="search"
            autoComplete="off"
            aria-label={t('somethingElse')}
            placeholder={t('somethingElse')}
            onChange={(event) => {
              setQuery(event.target.value)
            }}
            className="w-full rounded-ctl bg-sunk px-16 py-12 text-input text-ink placeholder:text-ink-3"
          />
          {(matches.length > 0 || nameOnly !== null) && (
            <div className="flex flex-wrap gap-8">
              {matches.map(pill)}
              {nameOnly !== null && (
                <Pressable
                  aria-pressed={choice?.kind === 'name' && choice.name === nameOnly}
                  onClick={() => {
                    setChoice({ kind: 'name', name: nameOnly })
                  }}
                  className={pillClass}
                >
                  <span className="text-body">{nameOnly}</span>
                  <span className="text-label opacity-70">{t('reestimateByName')}</span>
                </Pressable>
              )}
            </div>
          )}
          <Pressable
            role="switch"
            aria-checked={remember}
            onClick={() => {
              setRemember((current) => !current)
            }}
            className="flex items-center justify-between gap-12 py-4 text-left"
          >
            <span className="flex flex-col">
              <span className="text-body text-ink">{t('remember')}</span>
              <span className="text-label text-ink-3">{t('rememberHint')}</span>
            </span>
            <span
              aria-hidden
              className={`flex h-28 w-40 shrink-0 items-center rounded-full p-4 ${remember ? 'justify-end bg-accent' : 'justify-start bg-sunk'}`}
            >
              <span className="size-20 rounded-full bg-surface" />
            </span>
          </Pressable>
          <Pressable
            disabled={choice === null}
            onClick={() => {
              if (choice !== null) onSave(choice, remember)
            }}
            className="rounded-full bg-accent px-16 py-12 text-body font-semibold text-accent-ink disabled:bg-sunk disabled:text-ink-3"
          >
            {t('saveCorrection')}
          </Pressable>
        </div>
      )}
    </Sheet>
  )
}
