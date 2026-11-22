'use client'

import { useLocale, useTranslations } from 'next-intl'
import { useState } from 'react'

import { repositories } from '@/db/client'
import type { MealWithItems } from '@/db/food'
import { ConfirmButton } from '@/ui/confirm-button'
import { Pressable } from '@/ui/pressable'
import { Sheet } from '@/ui/sheet'
import { SwipeRow } from '@/ui/swipe-row'

import { formatTime } from '../history/dates'

const mealTitle = ({ meal, items }: MealWithItems) => meal.name ?? items[0]?.name ?? ''

// A day's meals, newest first. A tap opens the meal; a swipe left deletes it,
// and the meal's sheet offers the same delete for those who cannot swipe.
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
            <ul className="flex flex-col gap-8">
              {opened.items.map((item) => (
                <li key={item.id} className="flex items-baseline justify-between gap-12">
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate text-body text-ink">{item.name}</span>
                    <span className="num text-label text-ink-3">
                      {t('grams', { value: whole.format(item.grams) })}
                    </span>
                  </span>
                  <span className="flex shrink-0 flex-col items-end">
                    <span className="num text-body text-accent">
                      {t('proteinShort', { value: whole.format(item.proteinG) })}
                    </span>
                    <span className="num text-label text-ink-3">
                      {t('kcalShort', { value: whole.format(item.kcal) })}
                    </span>
                  </span>
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
