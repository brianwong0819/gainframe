'use client'

import { type MealItem, mealItemSchema, mealTypeSchema, scalePortion } from '@gainframe/shared'
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

// One tap on an item's gram stepper (design-system.md, "Food logging").
const GRAM_STEP = 10

// Typed grams, or null for anything the item schema would reject.
function parseGrams(text: string): number | null {
  const value = Number(text.trim().replace(',', '.'))
  if (text.trim() === '') return null
  return mealItemSchema.shape.grams.safeParse(value).success ? value : null
}

// A new portion keeps the food: protein and energy scale with the grams.
function setGrams(item: MealItem, grams: number) {
  void repositories.mealItems.update(item.id, scalePortion(item, grams))
}

const mealTitle = ({ meal, items }: MealWithItems) => meal.name ?? items[0]?.name ?? ''

// A day's meals, newest first. A tap opens the meal's sheet, where its type,
// each item's grams and its items can be changed; a swipe left deletes it,
// and the sheet offers the same delete for those who cannot swipe.
export function MealList({ meals }: { meals: MealWithItems[] }) {
  const t = useTranslations('food')
  const locale = useLocale()
  const whole = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 })
  const [swipedId, setSwipedId] = useState<string | null>(null)
  const [openId, setOpenId] = useState<string | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  const opened = meals.find(({ meal }) => meal.id === openId)
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
                    </span>
                    <span className="truncate text-body text-ink">{mealTitle(entry)}</span>
                    {items.length > 1 && (
                      <span className="truncate text-label text-ink-2">
                        {items.map((item) => item.name).join(' · ')}
                      </span>
                    )}
                  </span>
                  <span className="flex shrink-0 flex-col items-end gap-4">
                    <span className="num text-body text-accent">
                      {t('proteinShort', { value: whole.format(totals.proteinG) })}
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
              {opened.items.map((item) => (
                <li key={item.id} className="flex flex-col gap-8">
                  <div className="flex items-baseline justify-between gap-12">
                    <span className="min-w-0 truncate text-body text-ink">{item.name}</span>
                    <span className="num shrink-0 text-label text-ink-2">
                      <span className="text-accent">
                        {t('proteinShort', { value: whole.format(item.proteinG) })}
                      </span>
                      {' · '}
                      {t('kcalShort', { value: whole.format(item.kcal) })}
                    </span>
                  </div>
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
                </li>
              ))}
            </ul>
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
