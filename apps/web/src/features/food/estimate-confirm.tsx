'use client'

import {
  type FoodEstimateItem,
  foodLibrary,
  type FoodTableEntry,
  type MealType,
  type OilSauce,
  oilSauceKcal,
  oilSauceSchema,
  portionGrams,
  type PortionSize,
  scalePortion,
  spreadKcal,
  toLocalDate,
} from '@gainframe/shared'
import { useRouter } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import { type ReactNode, useCallback, useEffect, useState } from 'react'

import { db, repositories } from '@/db/client'
import { foodDay, logMeal, savedFoods } from '@/db/food'
import { currentProfile } from '@/db/profile'
import { useLiveQuery } from '@/db/use-live-query'
import { deviceTimeZone } from '@/i18n/time-zone'
import { ChoiceGroup } from '@/ui/choice-group'
import { Pressable } from '@/ui/pressable'
import { Stepper } from '@/ui/stepper'

import { type Correction, CorrectionSheet, type ItemToCorrect } from './correction-sheet'
import { loadFoodTable } from './food-table'
import { GRAM_STEP, parseGrams } from './grams'

// An estimated item as the user has checked it: `remember` is set when its
// name was corrected with "remember this correction" on.
export type EstimateRow = FoodEstimateItem & { remember: boolean }

export const toRows = (items: readonly FoodEstimateItem[]): EstimateRow[] =>
  items.map((item) => ({ ...item, remember: false }))

const portionSizes: readonly PortionSize[] = ['small', 'regular', 'large']

const readSaved = () => savedFoods(db)
const readProteinTarget = () =>
  currentProfile(db).then((profile) => (profile === undefined ? null : profile.proteinValue))

function Pencil() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden
      className="size-16 shrink-0 fill-none stroke-current text-ink-3"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 20h4L19 9l-4-4L4 16v4zM13 7l4 4" />
    </svg>
  )
}

// The confirm part of a photo or text estimate ("Confirm screen" in
// docs/design-system.md): the totals and their effect on today's protein, each
// item with its AI tag and confidence, a name to correct, portion sizes when
// the model is unsure and a gram stepper, the oil and sauce row, and the docked
// save. Every item is logged as source `ai` with the model's output in `aiRaw`.
export function EstimateConfirm({
  dishName,
  items,
  onItemsChange,
  mealType,
  notice,
}: {
  dishName: string | null
  items: readonly EstimateRow[]
  onItemsChange: (items: EstimateRow[]) => void
  mealType: MealType
  // A line above the totals: a photo issue, or a text estimate's assumptions.
  notice?: ReactNode
}) {
  const t = useTranslations('estimate')
  const tFood = useTranslations('food')
  const locale = useLocale()
  const router = useRouter()
  const whole = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 })
  const [oilSauce, setOilSauce] = useState<OilSauce>('usual')
  const [correcting, setCorrecting] = useState<{ index: number; item: ItemToCorrect } | null>(null)
  const [saving, setSaving] = useState(false)
  const [table, setTable] = useState<readonly FoodTableEntry[] | null>(null)
  const saved = useLiveQuery(readSaved)
  const proteinTarget = useLiveQuery(readProteinTarget)
  const [today] = useState(() => toLocalDate(new Date().toISOString(), deviceTimeZone()))
  const readToday = useCallback(() => foodDay(db, today), [today])
  const day = useLiveQuery(readToday)

  // Names in the user's language come from the food table, with their edits.
  useEffect(() => {
    let current = true
    void loadFoodTable().then((entries) => {
      if (current) setTable(entries)
    })
    return () => {
      current = false
    }
  }, [])

  const library = foodLibrary(table ?? [], saved ?? [], locale === 'zh' ? 'zh' : 'en')
  const byEntry = new Map(
    library.flatMap((food) => (food.tableId === null ? [] : [[food.tableId, food] as const])),
  )
  const entryOf = (item: EstimateRow) =>
    item.entryId === null ? undefined : byEntry.get(item.entryId)
  const nameOf = (item: EstimateRow) => entryOf(item)?.name ?? item.name
  const oilKcal = oilSauceKcal(items, oilSauce)
  // The figures as logged: the oil and sauce energy spread over the items.
  const logged = spreadKcal(items, oilKcal)
  const totals = logged.reduce(
    (sum, item) => ({ proteinG: sum.proteinG + item.proteinG, kcal: sum.kcal + item.kcal }),
    { proteinG: 0, kcal: 0 },
  )
  const setGrams = (index: number, grams: number) => {
    onItemsChange(
      items.map((item, i) => (i === index ? { ...item, ...scalePortion(item, grams) } : item)),
    )
  }

  const correct = (index: number, correction: Correction, remember: boolean) => {
    onItemsChange(
      items.map((item, i) => {
        if (i !== index) return item
        if (correction.kind === 'name') {
          return { ...item, name: correction.name, entryId: null, remember }
        }
        const { food } = correction
        return {
          ...item,
          name: food.name,
          entryId: food.tableId,
          proteinG: (food.proteinPer100G * item.grams) / 100,
          kcal: (food.kcalPer100G * item.grams) / 100,
          nutrients: 'table',
          remember,
        }
      }),
    )
    setCorrecting(null)
  }
  const openCorrection = (index: number, item: EstimateRow) => {
    setCorrecting({
      index,
      item: {
        name: nameOf(item),
        seen: item.raw.seen,
        grams: item.grams,
        alternatives: [...new Set([item.raw.entryId, ...item.alternativeIds])].flatMap((id) => {
          const food = id === null || id === item.entryId ? undefined : byEntry.get(id)
          return food === undefined ? [] : [food]
        }),
      },
    })
  }

  const save = async () => {
    setSaving(true)
    await logMeal(db, repositories, {
      eatenAt: new Date().toISOString(),
      timeZone: deviceTimeZone(),
      mealType,
      name: dishName,
      items: logged.map((item) => ({
        name: nameOf(item),
        grams: item.grams,
        proteinG: item.proteinG,
        kcal: item.kcal,
        source: 'ai',
        aiRaw: { ...item.raw, remember: item.remember, oilSauce },
      })),
    })
    router.push('/food')
  }

  const afterToday = (day?.totals.proteinG ?? 0) + totals.proteinG

  return (
    <>
      {notice}
      <section className="flex flex-col gap-4">
        <div className="flex items-end gap-28">
          <p className="flex flex-col">
            <span className="text-label text-ink-3">{t('proteinLabel')}</span>
            <span className="flex items-baseline gap-4">
              <span className="num text-display text-accent">{whole.format(totals.proteinG)}</span>
              <span className="text-section text-ink-2">{tFood('unitG')}</span>
            </span>
          </p>
          <p className="flex flex-col">
            <span className="text-label text-ink-3">{t('kcalLabel')}</span>
            <span className="flex items-baseline gap-4">
              <span className="num text-display">{whole.format(totals.kcal)}</span>
              <span className="text-section text-ink-2">{t('unitKcal')}</span>
            </span>
          </p>
        </div>
        {proteinTarget !== undefined && proteinTarget !== null && day !== undefined && (
          <p className="text-body text-ink-2">
            {afterToday >= proteinTarget
              ? t('reaches', {
                  value: whole.format(afterToday),
                  target: whole.format(proteinTarget),
                })
              : t('short', {
                  value: whole.format(afterToday),
                  target: whole.format(proteinTarget),
                  gap: whole.format(proteinTarget - afterToday),
                })}
          </p>
        )}
      </section>
      <ul className="flex flex-col divide-y divide-line rounded-group bg-surface px-16">
        {items.map((item, index) => {
          const name = nameOf(item)
          return (
            <li key={`${String(index)} ${item.raw.seen}`} className="flex flex-col gap-8 py-12">
              <div className="flex items-start justify-between gap-12">
                <span className="flex min-w-0 flex-col items-start">
                  <Pressable
                    aria-label={t('correct', { name })}
                    onClick={() => {
                      openCorrection(index, item)
                    }}
                    className="flex items-center gap-4 text-left text-body text-ink"
                  >
                    {name}
                    <Pencil />
                  </Pressable>
                  <span className="num text-label text-ink-3">
                    <span className="text-accent">
                      {t('protein', { value: whole.format(item.proteinG) })}
                    </span>
                    {' · '}
                    {t('kcal', { value: whole.format(item.kcal) })}
                    {item.nutrients === 'model' && ` · ${t('modelFigures')}`}
                  </span>
                  <span className="text-label text-ink-3">
                    <span className="text-accent">{t('aiTag')}</span>{' '}
                    {t(`confidence.${item.confidence}`)}
                  </span>
                </span>
                <Pressable
                  aria-label={t('remove', { name })}
                  onClick={() => {
                    onItemsChange(items.filter((_, i) => i !== index))
                  }}
                  className="shrink-0 py-4 text-label text-ink-2"
                >
                  {t('removeShort')}
                </Pressable>
              </div>
              {item.confidence === 'low' && (
                <div
                  role="group"
                  aria-label={t('portionSize', { name })}
                  className="grid grid-cols-3 gap-8"
                >
                  {portionSizes.map((size) => {
                    const grams = portionGrams(
                      entryOf(item)?.servings[0]?.grams ?? item.raw.grams,
                      size,
                    )
                    return (
                      <Pressable
                        key={size}
                        aria-pressed={item.grams === grams}
                        onClick={() => {
                          setGrams(index, grams)
                        }}
                        className="flex flex-col items-center rounded-ctl border border-line px-8 py-4 text-label text-ink-2 aria-pressed:border-ink aria-pressed:bg-ink aria-pressed:text-bg"
                      >
                        <span>{t(`portion.${size}`)}</span>
                        <span className="num">
                          {t('portionGrams', { grams: whole.format(grams) })}
                        </span>
                      </Pressable>
                    )
                  })}
                </div>
              )}
              <Stepper
                value={whole.format(item.grams)}
                editValue={String(item.grams)}
                inputMode="decimal"
                label={tFood('gramsOf', { name })}
                unit="g"
                onEnter={(text) => {
                  const grams = parseGrams(text)
                  if (grams !== null) setGrams(index, grams)
                }}
                canDecrease={item.grams > GRAM_STEP}
                decreaseLabel={tFood('gramsDown', { name })}
                increaseLabel={tFood('gramsUp', { name })}
                onStep={(direction) => {
                  setGrams(index, item.grams + direction * GRAM_STEP)
                }}
              />
            </li>
          )
        })}
        {items.length > 0 && (
          <li className="flex flex-col gap-8 py-12">
            <ChoiceGroup
              label={t('oilSauce')}
              options={oilSauceSchema.options}
              value={oilSauce}
              onChange={setOilSauce}
              optionLabel={(option) => t(`oilSauceChoice.${option}`)}
            />
            <p className="num text-label text-ink-3">
              {oilKcal === 0
                ? t('oilSauceUsual')
                : t('oilSauceKcal', {
                    sign: oilKcal > 0 ? '+' : '−',
                    value: whole.format(Math.abs(oilKcal)),
                  })}
            </p>
          </li>
        )}
      </ul>
      <CorrectionSheet
        item={correcting?.item ?? null}
        library={library}
        onClose={() => {
          setCorrecting(null)
        }}
        onSave={(correction, remember) => {
          if (correcting !== null) correct(correcting.index, correction, remember)
        }}
      />
      <div className="screen-dock flex">
        <Pressable
          disabled={items.length === 0 || saving}
          onClick={() => {
            void save()
          }}
          className="min-w-0 flex-1 truncate rounded-full bg-accent px-16 py-12 text-body font-semibold text-accent-ink disabled:bg-sunk disabled:text-ink-3"
        >
          {items.length === 0
            ? t('nothingLeft')
            : t('save', { meal: tFood(`mealType.${mealType}`) })}
        </Pressable>
      </div>
    </>
  )
}
