'use client'

import { domainConfig, mealTypeAt, type PastFood } from '@gainframe/shared'
import { useLocale, useTranslations } from 'next-intl'

import { db, repositories } from '@/db/client'
import { knownFoods, logMeal } from '@/db/food'
import { useLiveQuery } from '@/db/use-live-query'
import { deviceTimeZone } from '@/i18n/time-zone'
import { Pressable } from '@/ui/pressable'

const readFrequent = () =>
  knownFoods(db, 'frequent').then((foods) => foods.slice(0, domainConfig.frequentFoods))

/** Logs one portion of a past food now, as its own meal typed by the time of day. */
export async function logPortion(food: PastFood) {
  const now = new Date()
  return logMeal(db, repositories, {
    eatenAt: now.toISOString(),
    timeZone: deviceTimeZone(),
    mealType: mealTypeAt(now.getHours()),
    items: [
      {
        name: food.name,
        grams: food.grams,
        proteinG: food.proteinG,
        kcal: food.kcal,
        source: 'frequent',
        aiRaw: null,
      },
    ],
  })
}

// The user's frequent foods as one row of pills that scrolls sideways; a tap
// logs one portion at once (design-system.md, "Food logging": the 10-second
// path). Nothing shows until a food has been logged once.
export function FrequentFoods({ onLogged }: { onLogged: (mealId: string, name: string) => void }) {
  const t = useTranslations('food')
  const locale = useLocale()
  const whole = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 })
  const foods = useLiveQuery(readFrequent)
  if (foods === undefined || foods.length === 0) return null
  return (
    <section className="flex flex-col gap-8">
      <h2 className="text-label text-ink-3">{t('frequent')}</h2>
      <ul className="flex gap-8 overflow-x-auto">
        {foods.map((food) => (
          <li key={food.name} className="shrink-0">
            <Pressable
              aria-label={t('logPortion', { name: food.name })}
              onClick={() => {
                void logPortion(food).then((meal) => {
                  onLogged(meal.id, food.name)
                })
              }}
              className="flex flex-col items-start rounded-ctl bg-surface px-16 py-8 text-left"
            >
              <span className="text-body text-ink">{food.name}</span>
              <span className="num text-label text-accent">
                {t('proteinShort', { value: whole.format(food.proteinG) })}
              </span>
            </Pressable>
          </li>
        ))}
      </ul>
    </section>
  )
}
