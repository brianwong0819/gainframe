'use client'

import {
  domainConfig,
  type FoodTableEntry,
  type MealItemSource,
  type MealType,
  mealTypeAt,
  mealTypeSchema,
  scalePortion,
  searchByName,
} from '@gainframe/shared'
import { useRouter } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'

import { db, repositories } from '@/db/client'
import { knownFoods, logMeal } from '@/db/food'
import { useLiveQuery } from '@/db/use-live-query'
import { deviceTimeZone } from '@/i18n/time-zone'
import { ChoiceGroup } from '@/ui/choice-group'
import { Pressable } from '@/ui/pressable'

import { loadFoodTable } from './food-table'
import { type NewFood, NewFoodSheet } from './new-food-sheet'

interface Pick {
  food: NewFood
  count: number
  source: MealItemSource
}

const readFoods = () => knownFoods(db, 'frequent')
const key = (name: string) => name.trim().toLocaleLowerCase()

function Sign({ plus }: { plus: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden
      className="size-16 fill-none stroke-current"
      strokeWidth={1.75}
      strokeLinecap="round"
    >
      <path d={plus ? 'M6 12h12M12 6v12' : 'M6 12h12'} />
    </svg>
  )
}

// A food table entry as a food to pick: its name in the app's language and its
// typical serving.
function tableFood(entry: FoodTableEntry, locale: string): NewFood {
  return {
    name: locale === 'zh' ? entry.nameZh : entry.nameEn,
    ...scalePortion(
      { grams: 100, proteinG: entry.proteinPer100G, kcal: entry.kcalPer100G },
      entry.servingG,
    ),
  }
}

// The manual screen (/food/add): the user's own foods, searched or from the
// frequent and recent lists, then the bundled food table's matches for a
// search, chosen with plus and minus in portions, and new foods typed from a
// label. Nothing is written until the meal is saved.
export function ManualEntry() {
  const t = useTranslations('manual')
  const tFood = useTranslations('food')
  const locale = useLocale()
  const router = useRouter()
  const whole = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 })
  const foods = useLiveQuery(readFoods)
  const [mealType, setMealType] = useState<MealType>(() => mealTypeAt(new Date().getHours()))
  const [query, setQuery] = useState('')
  const [picks, setPicks] = useState<Map<string, Pick>>(new Map())
  const [creating, setCreating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [table, setTable] = useState<readonly FoodTableEntry[] | null>(null)
  const searching = query.trim() !== ''
  useEffect(() => {
    if (!searching || table !== null) return
    let current = true
    void loadFoodTable().then((entries) => {
      if (current) setTable(entries)
    })
    return () => {
      current = false
    }
  }, [searching, table])

  const change = (food: NewFood, source: MealItemSource, delta: number) => {
    setPicks((current) => {
      const next = new Map(current)
      const count = (current.get(key(food.name))?.count ?? 0) + delta
      if (count <= 0) next.delete(key(food.name))
      else next.set(key(food.name), { food, count, source })
      return next
    })
  }
  const chosen = [...picks.values()]
  const proteinG = chosen.reduce((sum, pick) => sum + pick.food.proteinG * pick.count, 0)
  const save = async () => {
    setSaving(true)
    await logMeal(db, repositories, {
      eatenAt: new Date().toISOString(),
      timeZone: deviceTimeZone(),
      mealType,
      items: chosen.map(({ food, count, source }) => ({
        name: food.name,
        grams: food.grams * count,
        proteinG: food.proteinG * count,
        kcal: food.kcal * count,
        source,
        aiRaw: null,
      })),
    })
    router.push('/food')
  }

  const row = (food: NewFood, source: MealItemSource) => {
    const count = picks.get(key(food.name))?.count ?? 0
    return (
      <li key={key(food.name)} className="flex items-center justify-between gap-12 py-8">
        <span className="flex min-w-0 flex-col">
          <span className="truncate text-body text-ink">{food.name}</span>
          <span className="text-label text-ink-3">
            {t('portion', {
              grams: whole.format(food.grams),
              protein: whole.format(food.proteinG),
              kcal: whole.format(food.kcal),
            })}
          </span>
        </span>
        <span className="flex shrink-0 items-center">
          {count > 0 && (
            <>
              <Pressable
                aria-label={t('less', { name: food.name })}
                onClick={() => {
                  change(food, source, -1)
                }}
                className="p-4 text-ink"
              >
                <span className="flex size-40 items-center justify-center rounded-full bg-sunk">
                  <Sign plus={false} />
                </span>
              </Pressable>
              <span className="num min-w-0 px-4 text-body text-ink" aria-live="polite">
                {count}
              </span>
            </>
          )}
          <Pressable
            aria-label={t('more', { name: food.name })}
            onClick={() => {
              change(food, source, 1)
            }}
            className="p-4 text-ink"
          >
            <span
              className={`flex size-40 items-center justify-center rounded-full ${count > 0 ? 'bg-sunk' : 'bg-accent text-accent-ink'}`}
            >
              <Sign plus />
            </span>
          </Pressable>
        </span>
      </li>
    )
  }

  const created = chosen.filter((pick) => pick.source === 'manual')
  const needle = key(query)
  const matches = (foods ?? []).filter((food) => key(food.name).includes(needle))
  const recent = (foods ?? []).toSorted((a, b) => b.lastAt.localeCompare(a.lastAt))
  const own = new Set(matches.map((food) => key(food.name)))
  const tableMatches =
    table === null || needle === ''
      ? []
      : searchByName(table, query)
          .map((entry) => tableFood(entry, locale))
          .filter((food) => !own.has(key(food.name)))
          .slice(0, domainConfig.foodTableResults)
  const list = (title: string, entries: NewFood[], source: MealItemSource) =>
    entries.length > 0 && (
      <section className="flex flex-col gap-4">
        <h2 className="text-label text-ink-3">{title}</h2>
        <ul className="flex flex-col rounded-group bg-surface px-16 py-8">
          {entries.map((food) => row(food, source))}
        </ul>
      </section>
    )

  return (
    <div className="flex flex-col gap-20">
      <h1 className="text-title">{t('title')}</h1>
      <ChoiceGroup
        label={t('mealType')}
        options={mealTypeSchema.options}
        value={mealType}
        onChange={setMealType}
        optionLabel={(option) => tFood(`mealType.${option}`)}
      />
      {foods !== undefined && (
        <input
          type="search"
          value={query}
          enterKeyHint="search"
          autoComplete="off"
          aria-label={t('searchLabel')}
          placeholder={t('search')}
          onChange={(event) => {
            setQuery(event.target.value)
          }}
          className="w-full rounded-ctl bg-surface px-16 py-12 text-input text-ink placeholder:text-ink-3"
        />
      )}
      {created.length > 0 && (
        <section className="flex flex-col gap-4">
          <h2 className="text-label text-ink-3">{t('created')}</h2>
          <ul className="flex flex-col rounded-group bg-surface px-16 py-8">
            {created.map(({ food }) => row(food, 'manual'))}
          </ul>
        </section>
      )}
      {needle === '' ? (
        <>
          {list(
            t('table'),
            chosen.filter((pick) => pick.source === 'table').map((pick) => pick.food),
            'table',
          )}
          {list(t('frequent'), (foods ?? []).slice(0, domainConfig.frequentFoods), 'frequent')}
          {list(t('recent'), recent.slice(0, domainConfig.frequentFoods), 'frequent')}
        </>
      ) : (
        <>
          {list(t('results'), matches, 'frequent')}
          {list(t('table'), tableMatches, 'table')}
        </>
      )}
      {foods?.length === 0 && created.length === 0 && needle === '' && (
        <p className="text-body text-ink-2">{t('noFoods')}</p>
      )}
      {needle !== '' && table !== null && matches.length === 0 && tableMatches.length === 0 && (
        <p className="text-body text-ink-2">{t('noMatch')}</p>
      )}
      {/* The dock writes, so it renders only once the foods have loaded (L-028). */}
      {foods !== undefined && (
        <div className="screen-dock flex gap-8">
          <Pressable
            onClick={() => {
              setCreating(true)
            }}
            className="rounded-full bg-surface px-16 py-12 text-body font-semibold text-ink"
          >
            {t('newFood')}
          </Pressable>
          <Pressable
            disabled={chosen.length === 0 || saving}
            onClick={() => {
              void save()
            }}
            className="min-w-0 flex-1 truncate rounded-full bg-accent px-16 py-12 text-body font-semibold text-accent-ink disabled:bg-sunk disabled:text-ink-3"
          >
            {chosen.length === 0
              ? t('chooseFirst')
              : t('save', {
                  meal: tFood(`mealType.${mealType}`),
                  count: chosen.length,
                  protein: whole.format(proteinG),
                })}
          </Pressable>
        </div>
      )}
      <NewFoodSheet
        open={creating}
        onClose={() => {
          setCreating(false)
        }}
        onAdd={(food) => {
          setCreating(false)
          change(food, 'manual', 1)
        }}
      />
    </div>
  )
}
