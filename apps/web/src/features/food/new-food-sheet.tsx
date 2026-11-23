'use client'

import { mealItemSchema } from '@gainframe/shared'
import { useTranslations } from 'next-intl'
import { useState } from 'react'

import { Pressable } from '@/ui/pressable'
import { Sheet } from '@/ui/sheet'

// One portion of a food to log. `serving` names the portion when it is a unit
// ("1 scoop"); the meal item stores only the grams and figures.
export interface NewFood {
  name: string
  grams: number
  proteinG: number
  kcal: number
  serving?: string
}

const fieldClass =
  'w-full rounded-ctl bg-sunk px-16 py-12 text-input text-ink placeholder:text-ink-3'

// A number typed in a field, or null when the item schema would reject it.
function parseField(text: string, field: 'grams' | 'proteinG' | 'kcal'): number | null {
  const value = Number(text.trim().replace(',', '.'))
  if (text.trim() === '') return null
  return mealItemSchema.shape[field].safeParse(value).success ? value : null
}

// A food of the user's own, copied once from its nutrition label: a name and
// one portion's grams, protein and energy. It is not stored on its own: the
// manual screen adds it to the meal, and once logged it is one of the user's
// foods (design-system.md, "Food logging").
export function NewFoodSheet({
  open,
  onClose,
  onAdd,
}: {
  open: boolean
  onClose: () => void
  onAdd: (food: NewFood) => void
}) {
  const t = useTranslations('manual')
  const [name, setName] = useState('')
  const [grams, setGrams] = useState('')
  const [protein, setProtein] = useState('')
  const [kcal, setKcal] = useState('')
  const parsed = {
    name: name.trim(),
    grams: parseField(grams, 'grams'),
    proteinG: parseField(protein, 'proteinG'),
    kcal: parseField(kcal, 'kcal'),
  }
  const valid =
    mealItemSchema.shape.name.safeParse(parsed.name).success &&
    parsed.grams !== null &&
    parsed.proteinG !== null &&
    parsed.kcal !== null
  const field = (
    label: string,
    value: string,
    set: (text: string) => void,
    inputMode: 'text' | 'decimal' | 'numeric',
  ) => (
    <label className="flex flex-col gap-8">
      <span className="text-label text-ink-3">{label}</span>
      <input
        value={value}
        inputMode={inputMode}
        autoComplete="off"
        onChange={(event) => {
          set(event.target.value)
        }}
        className={fieldClass}
      />
    </label>
  )
  return (
    <Sheet open={open} onClose={onClose} title={t('newFood')} closeLabel={t('close')}>
      <form
        className="flex flex-col gap-16"
        onSubmit={(event) => {
          event.preventDefault()
          if (parsed.grams === null || parsed.proteinG === null || parsed.kcal === null) return
          onAdd({
            name: parsed.name,
            grams: parsed.grams,
            proteinG: parsed.proteinG,
            kcal: parsed.kcal,
          })
          setName('')
          setGrams('')
          setProtein('')
          setKcal('')
        }}
      >
        <p className="text-label text-ink-2">{t('labelHint')}</p>
        {field(t('name'), name, setName, 'text')}
        <div className="grid grid-cols-3 gap-8">
          {field(t('portionGrams'), grams, setGrams, 'decimal')}
          {field(t('portionProtein'), protein, setProtein, 'decimal')}
          {field(t('portionKcal'), kcal, setKcal, 'numeric')}
        </div>
        <Pressable
          type="submit"
          disabled={!valid}
          className="rounded-full bg-accent px-16 py-12 text-body font-semibold text-accent-ink disabled:bg-sunk disabled:text-ink-3"
        >
          {t('addFood')}
        </Pressable>
      </form>
    </Sheet>
  )
}
