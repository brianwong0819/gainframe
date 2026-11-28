'use client'

import {
  domainConfig,
  foodLibrary,
  type FoodTableEntry,
  type LibraryFood,
  type MealItemSource,
  type MealType,
  mealTypeAt,
  mealTypeSchema,
  type PastFood,
  per100G,
  portionOf,
  searchByName,
} from '@gainframe/shared'
import { useRouter } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import { type ReactNode, useEffect, useState } from 'react'

import { db, repositories } from '@/db/client'
import { knownFoods, logMeal, saveFood, savedFoods } from '@/db/food'
import { useLiveQuery } from '@/db/use-live-query'
import { deviceTimeZone } from '@/i18n/time-zone'
import { ChoiceGroup } from '@/ui/choice-group'
import { Chevron } from '@/ui/chevron'
import { Pressable } from '@/ui/pressable'

import { AiLockedNote, useAiAccess } from './ai-access'
import { setPendingText } from './describe'
import { FoodSheet, type FoodToEdit } from './food-sheet'
import { loadFoodTable } from './food-table'
import { type NewFood, NewFoodSheet } from './new-food-sheet'

interface Pick {
  food: NewFood
  count: number
  source: MealItemSource
}

const readFoods = () => knownFoods(db, 'frequent')
const readSaved = () => savedFoods(db)
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

// A library food as a food to pick: its first serving, named when the serving
// has a name ("1 scoop").
function libraryFood(food: LibraryFood): NewFood {
  const serving = food.servings[0] ?? { label: null, grams: 100 }
  return {
    name: food.name,
    ...portionOf(food, serving.grams),
    ...(serving.label !== null && { serving: serving.label }),
  }
}

const toEdit = (food: LibraryFood): FoodToEdit => ({
  ...food,
  target: { id: food.foodId, tableId: food.tableId },
})

// A food known only from logged meals, edited as a new own food of that name.
const pastToEdit = (food: NewFood): FoodToEdit => ({
  key: `past ${key(food.name)}`,
  origin: 'past',
  target: { id: null, tableId: null },
  source: null,
  name: food.name,
  ...per100G(food),
  servings: [{ label: null, grams: food.grams }],
})

// The manual screen (/food/add): the user's saved foods and edits, the
// frequent and recent lists, and for a search the bundled food table's matches,
// chosen with plus and minus in portions. A tap on a food's name opens its
// sheet to edit it (M3-12); a new food typed from a label is saved to the
// library. The meal is written when it is saved.
export function ManualEntry() {
  const t = useTranslations('manual')
  const tDescribe = useTranslations('describe')
  const aiAccess = useAiAccess()
  const tEstimate = useTranslations('estimate')
  const tFood = useTranslations('food')
  const locale = useLocale()
  const router = useRouter()
  const whole = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 })
  const foods = useLiveQuery(readFoods)
  const saved = useLiveQuery(readSaved)
  const [editing, setEditing] = useState<FoodToEdit | null>(null)
  const [mealType, setMealType] = useState<MealType>(() => mealTypeAt(new Date().getHours()))
  const [query, setQuery] = useState('')
  const [picks, setPicks] = useState<Map<string, Pick>>(new Map())
  const [creating, setCreating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [table, setTable] = useState<readonly FoodTableEntry[] | null>(null)
  // The table is a large chunk: it loads for a search, or to show the user's
  // edits of its entries.
  const needsTable = query.trim() !== '' || (saved ?? []).some((food) => food.tableId !== null)
  useEffect(() => {
    if (!needsTable || table !== null) return
    let current = true
    void loadFoodTable().then((entries) => {
      if (current) setTable(entries)
    })
    return () => {
      current = false
    }
  }, [needsTable, table])

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

  const row = (food: NewFood, source: MealItemSource, edit: FoodToEdit) => {
    const count = picks.get(key(food.name))?.count ?? 0
    const portion = {
      grams: whole.format(food.grams),
      protein: whole.format(food.proteinG),
      kcal: whole.format(food.kcal),
    }
    return (
      <li key={key(food.name)} className="flex items-center justify-between gap-12 py-8">
        <Pressable
          aria-label={t('edit', { name: food.name })}
          onClick={() => {
            setEditing(edit)
          }}
          className="flex min-w-0 flex-1 flex-col items-start text-left"
        >
          <span className="flex max-w-full items-center gap-8">
            <span className="truncate text-body text-ink">{food.name}</span>
            {edit.origin === 'edited' && (
              <span className="shrink-0 text-label text-ink-3">{t('edited')}</span>
            )}
          </span>
          <span className="text-label text-ink-3">
            {food.serving === undefined
              ? t('portion', portion)
              : t('servingPortion', { ...portion, serving: food.serving })}
          </span>
        </Pressable>
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
            <span className={`flex size-40 items-center justify-center rounded-full bg-sunk`}>
              <Sign plus />
            </span>
          </Pressable>
        </span>
      </li>
    )
  }

  const library = foodLibrary(table ?? [], saved ?? [], locale === 'zh' ? 'zh' : 'en')
  const mine = library.filter((food) => food.origin !== 'table')
  // Own foods and edits win a name shared with a table entry.
  const byName = new Map(
    [...library.filter((food) => food.origin === 'table'), ...mine].map((food) => [
      key(food.name),
      food,
    ]),
  )
  const editOf = (food: NewFood) => {
    const known = byName.get(key(food.name))
    return known === undefined ? pastToEdit(food) : toEdit(known)
  }
  const needle = key(query)
  const mineMatches = searchByName(mine, query)
  const shown = new Set(mineMatches.map((food) => key(food.name)))
  const pastMatches = (foods ?? []).filter(
    (food) => key(food.name).includes(needle) && !shown.has(key(food.name)),
  )
  for (const food of pastMatches) shown.add(key(food.name))
  const recent = (foods ?? []).toSorted((a, b) => b.lastAt.localeCompare(a.lastAt))
  const tableMatches =
    table === null || needle === ''
      ? []
      : searchByName(
          library.filter((food) => food.origin === 'table'),
          query,
        )
          .filter((food) => !shown.has(key(food.name)))
          .slice(0, domainConfig.foodTableResults)
  const section = (title: string, rows: ReactNode[]) =>
    rows.length > 0 && (
      <section className="flex flex-col gap-4">
        <h2 className="text-label text-ink-3">{title}</h2>
        <ul className="flex flex-col rounded-group bg-surface px-16 py-8">{rows}</ul>
      </section>
    )
  const libraryRows = (entries: LibraryFood[]) =>
    entries.map((food) =>
      row(libraryFood(food), food.origin === 'own' ? 'manual' : 'table', toEdit(food)),
    )
  const pastRows = (entries: PastFood[]) =>
    entries.map((food) => row(food, 'frequent', editOf(food)))
  const frequent = (foods ?? []).slice(0, domainConfig.frequentFoods)
  const latest = recent.slice(0, domainConfig.frequentFoods)
  // A saved food already in the frequent or recent list is listed there only.
  const listed = new Set([...frequent, ...latest].map((food) => key(food.name)))
  const mineUnlisted = mine.filter((food) => !listed.has(key(food.name)))
  const mineNames = new Set(mine.map((food) => key(food.name)))
  const tablePicks = chosen.filter(
    (pick) => pick.source === 'table' && !mineNames.has(key(pick.food.name)),
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
        chips
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
      {/* A food the lists lack is described in a sentence for the AI (M3-10);
          the search text is the start of the description. */}
      <Pressable
        disabled={aiAccess !== 'allowed'}
        aria-describedby="describe-locked"
        onClick={() => {
          setPendingText(query.trim())
          router.push('/food/describe')
        }}
        className="flex items-center justify-between gap-12 rounded-group bg-surface px-16 py-12 text-left disabled:text-ink-3"
      >
        <span className="flex flex-col">
          <span className={`text-body ${aiAccess === 'allowed' ? 'text-ink' : 'text-ink-3'}`}>
            <span className={`text-label ${aiAccess === 'allowed' ? 'text-accent' : ''}`}>
              {tEstimate('aiTag')}
            </span>{' '}
            {tDescribe('entry')}
          </span>
          {aiAccess === 'allowed' ? (
            <span className="text-label text-ink-3">{tDescribe('entryHint')}</span>
          ) : (
            <AiLockedNote access={aiAccess} id="describe-locked" />
          )}
        </span>
        <span className="text-ink-3">
          <Chevron direction="right" />
        </span>
      </Pressable>
      {needle === '' ? (
        <>
          {section(t('mine'), libraryRows(mineUnlisted))}
          {section(
            t('table'),
            tablePicks.map((pick) => row(pick.food, 'table', editOf(pick.food))),
          )}
          {section(t('frequent'), pastRows(frequent))}
          {section(t('recent'), pastRows(latest))}
        </>
      ) : (
        <>
          {section(t('results'), [...libraryRows(mineMatches), ...pastRows(pastMatches)])}
          {section(t('table'), libraryRows(tableMatches))}
        </>
      )}
      {foods?.length === 0 && mine.length === 0 && needle === '' && (
        <p className="text-body text-ink-2">{t('noFoods')}</p>
      )}
      {needle !== '' && table !== null && shown.size === 0 && tableMatches.length === 0 && (
        <p className="text-body text-ink-2">{t('noMatch')}</p>
      )}
      {/* The dock writes, so it renders only once the foods have loaded (L-028). */}
      {foods !== undefined && (
        <div className="screen-dock-band flex gap-8">
          <Pressable
            onClick={() => {
              setCreating(true)
            }}
            className="rounded-full bg-sunk px-16 py-12 text-body font-semibold text-ink"
          >
            {t('newFood')}
          </Pressable>
          <Pressable
            disabled={chosen.length === 0 || saving}
            onClick={() => {
              void save()
            }}
            className="min-w-0 flex-1 truncate rounded-full bg-accent px-16 py-12 text-body font-semibold text-accent-ink disabled:bg-sunk disabled:font-normal disabled:text-ink-3"
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
          void saveFood(
            db,
            repositories,
            { id: null, tableId: null },
            { name: food.name, ...per100G(food), servings: [{ label: null, grams: food.grams }] },
          )
        }}
      />
      <FoodSheet
        food={editing}
        onClose={() => {
          setEditing(null)
        }}
        onSaved={(name) => {
          setPicks((current) => {
            const next = new Map(current)
            next.delete(key(name))
            return next
          })
        }}
      />
    </div>
  )
}
