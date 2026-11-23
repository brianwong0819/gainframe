'use client'

import {
  domainConfig,
  type FoodOrigin,
  foodSchema,
  foodServingSchema,
  type FoodServing,
  type FoodTableSource,
  per100G,
  portionOf,
} from '@gainframe/shared'
import { useLocale, useTranslations } from 'next-intl'
import { useState } from 'react'

import { db, repositories } from '@/db/client'
import { removeFood, saveFood } from '@/db/food'
import { ConfirmButton } from '@/ui/confirm-button'
import { Pressable } from '@/ui/pressable'
import { Sheet } from '@/ui/sheet'

// A food the sheet edits. `past` is a food known only from logged meals; saving
// it makes it one of the user's own foods. `target` names the row to write: the
// food's id, the table entry it edits, or neither for a new own food.
export interface FoodToEdit {
  key: string
  origin: FoodOrigin | 'past'
  target: { id: string | null; tableId: string | null }
  source: FoodTableSource | null
  name: string
  proteinPer100G: number
  kcalPer100G: number
  servings: readonly FoodServing[]
}

interface ServingField {
  label: string
  grams: string
}

const fieldClass =
  'w-full min-w-0 rounded-ctl bg-sunk px-16 py-12 text-input text-ink placeholder:text-ink-3'
const round1 = (value: number) => String(Math.round(value * 10) / 10)

function parseNumber(text: string): number | null {
  if (text.trim() === '') return null
  const value = Number(text.trim().replace(',', '.'))
  return Number.isFinite(value) ? value : null
}

// The values the form holds, checked against the food schema, or null.
function parseForm(name: string, servings: readonly ServingField[], protein: string, kcal: string) {
  const parsed = servings.map((serving) =>
    foodServingSchema.safeParse({
      label: serving.label.trim() === '' ? null : serving.label.trim(),
      grams: parseNumber(serving.grams),
    }),
  )
  const first = parsed[0]?.data
  const proteinG = parseNumber(protein)
  const kcalValue = parseNumber(kcal)
  if (first === undefined || proteinG === null || kcalValue === null) return null
  if (parsed.some((serving) => !serving.success)) return null
  const values = {
    name: name.trim(),
    ...per100G({ grams: first.grams, proteinG, kcal: kcalValue }),
    servings: parsed.flatMap((serving) => (serving.data === undefined ? [] : [serving.data])),
  }
  const shape = foodSchema.pick({
    name: true,
    proteinPer100G: true,
    kcalPer100G: true,
    servings: true,
  })
  return shape.safeParse(values).data ?? null
}

// Edits a food of the library (M3-12): its name, its servings ("1 scoop",
// 35 g; the first is the one a tap adds) and its protein and energy for the
// first serving, as a nutrition label gives them. An edited table entry can be
// restored and an own food deleted. Logged meals keep their figures.
export function FoodSheet({
  food,
  onClose,
  onSaved,
}: {
  food: FoodToEdit | null
  onClose: () => void
  onSaved: (name: string) => void
}) {
  const t = useTranslations('foodSheet')
  return (
    <Sheet open={food !== null} onClose={onClose} title={t('title')} closeLabel={t('close')}>
      {food !== null && <FoodForm key={food.key} food={food} onClose={onClose} onSaved={onSaved} />}
    </Sheet>
  )
}

function FoodForm({
  food,
  onClose,
  onSaved,
}: {
  food: FoodToEdit
  onClose: () => void
  onSaved: (name: string) => void
}) {
  const t = useTranslations('foodSheet')
  const locale = useLocale()
  const first = food.servings[0] ?? { label: null, grams: 100 }
  const firstPortion = portionOf(food, first.grams)
  const [name, setName] = useState(food.name)
  const [servings, setServings] = useState<ServingField[]>(
    food.servings.map((serving) => ({ label: serving.label ?? '', grams: String(serving.grams) })),
  )
  const [protein, setProtein] = useState(round1(firstPortion.proteinG))
  const [kcal, setKcal] = useState(String(Math.round(firstPortion.kcal)))
  const [busy, setBusy] = useState(false)
  const values = parseForm(name, servings, protein, kcal)
  const one = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 })
  const whole = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 })
  const firstLabel = servings[0]?.label.trim() ?? ''

  const setServing = (index: number, change: Partial<ServingField>) => {
    setServings((current) =>
      current.map((serving, at) => (at === index ? { ...serving, ...change } : serving)),
    )
  }
  // `onSaved` gets the name the food had, under which it may be chosen.
  const run = async (write: () => Promise<unknown>) => {
    setBusy(true)
    await write()
    onSaved(food.name)
    onClose()
  }

  return (
    <form
      className="flex flex-col gap-16"
      onSubmit={(event) => {
        event.preventDefault()
        if (values === null || busy) return
        void run(() => saveFood(db, repositories, food.target, values))
      }}
    >
      <p className="text-label text-ink-2">
        {food.origin === 'table' || food.origin === 'edited'
          ? t(food.origin === 'edited' ? 'editedHint' : 'tableHint', {
              source: t(`source.${food.source ?? 'usda'}`),
            })
          : t('ownHint')}
      </p>
      <label className="flex flex-col gap-8">
        <span className="text-label text-ink-3">{t('name')}</span>
        <input
          value={name}
          autoComplete="off"
          onChange={(event) => {
            setName(event.target.value)
          }}
          className={fieldClass}
        />
      </label>
      <section className="flex flex-col gap-8">
        <h3 className="text-label text-ink-3">{t('servings')}</h3>
        {servings.map((serving, index) => (
          <div key={index} className="flex items-center gap-8">
            <input
              value={serving.label}
              autoComplete="off"
              aria-label={t('servingLabel', { n: index + 1 })}
              placeholder={index === 0 ? t('servingPlaceholder') : t('servingOther')}
              onChange={(event) => {
                setServing(index, { label: event.target.value })
              }}
              className={`${fieldClass} flex-2`}
            />
            <input
              value={serving.grams}
              inputMode="decimal"
              autoComplete="off"
              aria-label={t('servingGrams', { n: index + 1 })}
              onChange={(event) => {
                setServing(index, { grams: event.target.value })
              }}
              className={`${fieldClass} flex-1 text-right`}
            />
            <span className="text-label text-ink-3">g</span>
            {index > 0 && (
              <Pressable
                aria-label={t('removeServing', { n: index + 1 })}
                onClick={() => {
                  setServings((current) => current.filter((_, at) => at !== index))
                }}
                className="p-8 text-ink-3"
              >
                <svg
                  viewBox="0 0 24 24"
                  aria-hidden
                  className="size-16 fill-none stroke-current"
                  strokeWidth={1.75}
                  strokeLinecap="round"
                >
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </Pressable>
            )}
          </div>
        ))}
        {servings.length < domainConfig.foodServingsMax && (
          <Pressable
            onClick={() => {
              setServings((current) => [...current, { label: '', grams: '' }])
            }}
            className="self-start rounded-full bg-sunk px-16 py-8 text-label font-semibold text-ink"
          >
            {t('addServing')}
          </Pressable>
        )}
      </section>
      <section className="flex flex-col gap-8">
        <h3 className="text-label text-ink-3">
          {t('perServing', {
            serving: firstLabel === '' ? `${servings[0]?.grams ?? ''} g` : firstLabel,
          })}
        </h3>
        <div className="grid grid-cols-2 gap-8">
          <label className="flex flex-col gap-8">
            <span className="text-label text-ink-3">{t('protein')}</span>
            <input
              value={protein}
              inputMode="decimal"
              autoComplete="off"
              onChange={(event) => {
                setProtein(event.target.value)
              }}
              className={fieldClass}
            />
          </label>
          <label className="flex flex-col gap-8">
            <span className="text-label text-ink-3">{t('kcal')}</span>
            <input
              value={kcal}
              inputMode="numeric"
              autoComplete="off"
              onChange={(event) => {
                setKcal(event.target.value)
              }}
              className={fieldClass}
            />
          </label>
        </div>
        <p className="text-label text-ink-3" aria-live="polite">
          {values === null
            ? t('invalid')
            : t('per100', {
                protein: one.format(values.proteinPer100G),
                kcal: whole.format(values.kcalPer100G),
              })}
        </p>
      </section>
      <p className="text-label text-ink-2">{t('pastMeals')}</p>
      <Pressable
        type="submit"
        disabled={values === null || busy}
        className="rounded-full bg-accent px-16 py-12 text-body font-semibold text-accent-ink disabled:bg-sunk disabled:text-ink-3"
      >
        {t('save')}
      </Pressable>
      {food.origin === 'edited' && (
        <ConfirmButton
          label={t('restore')}
          confirmLabel={t('restoreConfirm')}
          onConfirm={() => {
            void run(() => removeFood(db, repositories, food.target))
          }}
        />
      )}
      {food.origin === 'own' && (
        <ConfirmButton
          label={t('delete')}
          confirmLabel={t('deleteConfirm')}
          onConfirm={() => {
            void run(() => removeFood(db, repositories, food.target))
          }}
        />
      )}
    </form>
  )
}
