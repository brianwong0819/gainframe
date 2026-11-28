'use client'

import {
  type EstimateAiRaw,
  estimateAiRawSchema,
  type MealItem,
  mealItemSchema,
  mealTypeSchema,
  scalePortion,
} from '@gainframe/shared'
import { useLocale, useTranslations } from 'next-intl'
import { useState } from 'react'

import { repositories } from '@/db/client'
import type { MealWithItems } from '@/db/food'
import { ChoiceGroup } from '@/ui/choice-group'
import { ConfirmButton } from '@/ui/confirm-button'
import { Pressable } from '@/ui/pressable'
import { Sheet } from '@/ui/sheet'
import { Stepper } from '@/ui/stepper'
import { SwipeRow } from '@/ui/swipe-row'

import { formatTime } from '../history/dates'
import { AiConfidence } from './ai-confidence'
import { GRAM_STEP, parseGrams } from './grams'

// A typed protein or energy figure, or null for anything the schema rejects.
function parseNutrient(text: string, field: 'proteinG' | 'kcal'): number | null {
  const value = Number(text.trim().replace(',', '.'))
  if (text.trim() === '') return null
  return mealItemSchema.shape[field].safeParse(value).success ? value : null
}

// Protein or energy as typed text: one decimal at most, no grouping.
const editText = (value: number) => String(Math.round(value * 10) / 10)

interface NutrientFieldProps {
  label: string
  accessibleName: string
  unit: string
  value: string
  editValue: string
  inputMode: 'decimal' | 'numeric'
  onEnter: (text: string) => void
}

// A figure of an item the user can correct, e.g. from the dish's label. Like
// the stepper's number, the typed text is sent on blur or Enter.
function NutrientField(props: NutrientFieldProps) {
  const [draft, setDraft] = useState<string | null>(null)
  return (
    <label className="flex min-w-0 flex-col gap-4">
      <span className="text-label text-ink-3">{props.label}</span>
      <span className="flex items-baseline gap-4 rounded-ctl bg-sunk px-16 py-12">
        <input
          aria-label={props.accessibleName}
          inputMode={props.inputMode}
          enterKeyHint="done"
          autoComplete="off"
          value={draft ?? props.value}
          onFocus={(event) => {
            setDraft(props.editValue)
            event.currentTarget.select()
          }}
          onChange={(event) => {
            setDraft(event.target.value)
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') event.currentTarget.blur()
          }}
          onBlur={() => {
            if (draft !== null && draft !== props.editValue) props.onEnter(draft)
            setDraft(null)
          }}
          className="num w-full min-w-0 bg-transparent text-input text-ink"
        />
        <span className="text-label text-ink-3">{props.unit}</span>
      </span>
    </label>
  )
}

// A new portion keeps the food: protein and energy scale with the grams.
function setGrams(item: MealItem, grams: number) {
  void repositories.mealItems.update(item.id, scalePortion(item, grams))
}

const mealTitle = ({ meal, items }: MealWithItems) => meal.name ?? items[0]?.name ?? ''

// The model's estimate stored with an AI item, or null for any other item and
// for an estimate saved in a shape this version cannot read.
function estimateOf(item: MealItem): EstimateAiRaw | null {
  if (item.source !== 'ai') return null
  const estimate = estimateAiRawSchema.safeParse(item.aiRaw)
  return estimate.success ? estimate.data : null
}

// A day's meals, newest first, with the AI source tag on estimated meals. A tap
// opens the meal's sheet, where its type, each item's grams, protein and energy,
// and its items can be changed, and an estimated item shows what the model saw,
// its confidence and its own grams; a swipe left deletes the meal, and the sheet
// offers the same delete for those who cannot swipe.
export function MealList({ meals }: { meals: MealWithItems[] }) {
  const t = useTranslations('food')
  const tEstimate = useTranslations('estimate')
  const tDescribe = useTranslations('describe')
  const locale = useLocale()
  const whole = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 })
  const tenths = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 })
  const [swipedId, setSwipedId] = useState<string | null>(null)
  const [openId, setOpenId] = useState<string | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  const opened = meals.find(({ meal }) => meal.id === openId)
  // The meal-level choices of an estimate, the same on each of its items.
  const openedEstimate = opened?.items.map(estimateOf).find((estimate) => estimate !== null)
  const remove = (mealId: string) => {
    setSwipedId(null)
    setSheetOpen(false)
    void repositories.meals.remove(mealId)
  }
  return (
    <section className="flex flex-col gap-8">
      <h2 className="text-label text-ink-3">{t('meals')}</h2>
      <ol className="flex flex-col gap-8">
        {meals.map((entry) => {
          const { meal, items, totals } = entry
          return (
            <li key={meal.id}>
              <SwipeRow
                open={swipedId === meal.id}
                onOpenChange={(open) => {
                  setSwipedId(open ? meal.id : null)
                }}
                actionLabel={t('delete')}
                onAction={() => {
                  remove(meal.id)
                }}
              >
                <Pressable
                  onClick={() => {
                    setSwipedId(null)
                    setOpenId(meal.id)
                    setSheetOpen(true)
                  }}
                  className="flex w-full items-center justify-between gap-12 bg-surface p-16 text-left"
                >
                  <span className="flex min-w-0 flex-col gap-4">
                    <span className="num text-label text-ink-3">
                      {formatTime(meal.eatenAt, locale)} · {t(`mealType.${meal.mealType}`)}
                      {items.some((item) => item.source === 'ai') && (
                        <>
                          {' · '}
                          <span className="text-accent">{tEstimate('aiTag')}</span>
                        </>
                      )}
                    </span>
                    <span className="truncate text-body text-ink">{mealTitle(entry)}</span>
                    {items.length > 1 && (
                      <span className="truncate text-label text-ink-2">
                        {items.map((item) => item.name).join(' · ')}
                      </span>
                    )}
                  </span>
                  <span className="flex shrink-0 flex-col items-end gap-4">
                    <span className="text-body text-ink-2">
                      {t.rich('proteinRich', {
                        value: whole.format(totals.proteinG),
                        figure: (chunks) => <span className="num text-accent">{chunks}</span>,
                      })}
                    </span>
                    <span className="num text-label text-ink-3">
                      {t('kcalShort', { value: whole.format(totals.kcal) })}
                    </span>
                  </span>
                </Pressable>
              </SwipeRow>
            </li>
          )
        })}
      </ol>
      <Sheet
        open={sheetOpen}
        onClose={() => {
          setSheetOpen(false)
        }}
        title={opened === undefined ? '' : mealTitle(opened)}
        closeLabel={t('close')}
      >
        {opened !== undefined && (
          <div className="flex flex-col gap-16">
            <p className="num text-label text-ink-3">
              {formatTime(opened.meal.eatenAt, locale)} · {t(`mealType.${opened.meal.mealType}`)}
            </p>
            <ChoiceGroup
              label={t('mealTypeLabel')}
              options={mealTypeSchema.options}
              value={opened.meal.mealType}
              onChange={(mealType) => {
                void repositories.meals.update(opened.meal.id, { mealType })
              }}
              optionLabel={(option) => t(`mealType.${option}`)}
            />
            <ul className="flex flex-col gap-16">
              {opened.items.map((item) => {
                const estimate = estimateOf(item)
                return (
                  <li key={item.id} className="flex flex-col gap-8">
                    <span className="flex min-w-0 flex-col gap-4">
                      <span className="truncate text-body text-ink">{item.name}</span>
                      {estimate !== null && (
                        <>
                          <AiConfidence confidence={estimate.confidence} />
                          <span className="text-label text-ink-3">
                            {tEstimate('seen', { seen: estimate.seen })}
                            {Math.round(estimate.grams) !== Math.round(item.grams) &&
                              ` · ${t('aiGrams', { grams: whole.format(estimate.grams) })}`}
                          </span>
                        </>
                      )}
                    </span>
                    <div className="flex items-center gap-8">
                      <div className="min-w-0 flex-1">
                        <Stepper
                          value={whole.format(item.grams)}
                          editValue={String(item.grams)}
                          inputMode="decimal"
                          label={t('gramsOf', { name: item.name })}
                          unit="g"
                          onEnter={(text) => {
                            const grams = parseGrams(text)
                            if (grams !== null) setGrams(item, grams)
                          }}
                          canDecrease={item.grams > GRAM_STEP}
                          decreaseLabel={t('gramsDown', { name: item.name })}
                          increaseLabel={t('gramsUp', { name: item.name })}
                          onStep={(direction) => {
                            setGrams(item, item.grams + direction * GRAM_STEP)
                          }}
                        />
                      </div>
                      <Pressable
                        onClick={() => {
                          if (opened.items.length === 1) remove(opened.meal.id)
                          else void repositories.mealItems.remove(item.id)
                        }}
                        className="shrink-0 rounded-full bg-sunk px-16 py-12 text-label font-semibold text-ink-2"
                      >
                        {t('removeItem')}
                      </Pressable>
                    </div>
                    <div className="grid grid-cols-2 gap-8">
                      <NutrientField
                        label={t('proteinLabel')}
                        accessibleName={t('proteinOf', { name: item.name })}
                        unit="g"
                        value={tenths.format(item.proteinG)}
                        editValue={editText(item.proteinG)}
                        inputMode="decimal"
                        onEnter={(text) => {
                          const proteinG = parseNutrient(text, 'proteinG')
                          if (proteinG !== null)
                            void repositories.mealItems.update(item.id, { proteinG })
                        }}
                      />
                      <NutrientField
                        label={t('kcalLabel')}
                        accessibleName={t('kcalOf', { name: item.name })}
                        unit="kcal"
                        value={whole.format(item.kcal)}
                        editValue={editText(item.kcal)}
                        inputMode="decimal"
                        onEnter={(text) => {
                          const kcal = parseNutrient(text, 'kcal')
                          if (kcal !== null) void repositories.mealItems.update(item.id, { kcal })
                        }}
                      />
                    </div>
                  </li>
                )
              })}
            </ul>
            {openedEstimate !== undefined && (
              <div className="flex flex-col gap-4 text-label text-ink-3">
                <p>
                  {t('oilSauceWas', {
                    choice: tEstimate(`oilSauceChoice.${openedEstimate.oilSauce}`),
                  })}
                </p>
                {openedEstimate.assumptions !== undefined &&
                  openedEstimate.assumptions !== null && (
                    <p>{tDescribe('assumed', { assumptions: openedEstimate.assumptions })}</p>
                  )}
              </div>
            )}
            <ConfirmButton
              label={t('deleteMeal')}
              confirmLabel={t('deleteMealConfirm')}
              onConfirm={() => {
                remove(opened.meal.id)
              }}
            />
          </div>
        )}
      </Sheet>
    </section>
  )
}
