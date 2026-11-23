'use client'

import {
  FOOD_ESTIMATES_PER_DAY,
  type FoodEstimateItem,
  foodEstimateResponseSchema,
  foodLibrary,
  type FoodTableEntry,
  type MealType,
  mealTypeAt,
  mealTypeSchema,
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
import { useCallback, useEffect, useState } from 'react'

import { ApiRequestError, NotSignedInError } from '@/api/client'
import { db, repositories } from '@/db/client'
import { foodDay, logMeal, savedFoods } from '@/db/food'
import { currentProfile } from '@/db/profile'
import { useLiveQuery } from '@/db/use-live-query'
import { deviceTimeZone } from '@/i18n/time-zone'
import { api } from '@/sync/backup'
import { ChoiceGroup } from '@/ui/choice-group'
import { Pressable, PressableLink } from '@/ui/pressable'
import { Stepper } from '@/ui/stepper'

import { type Correction, CorrectionSheet, type ItemToCorrect } from './correction-sheet'
import { loadFoodTable } from './food-table'
import { GRAM_STEP, parseGrams } from './grams'
import { type EncodedPhoto, encodePhoto, pendingPhoto, setPendingPhoto } from './photo'
import { PhotoPicker } from './photo-picker'

const portionSizes: readonly PortionSize[] = ['small', 'regular', 'large']

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

type Problem = 'signIn' | 'offline' | 'failed' | 'noFood' | 'capped'

type Phase =
  | { kind: 'estimating' }
  | { kind: 'problem'; problem: Problem }
  | { kind: 'ready'; dishName: string | null; items: Row[] }

// An estimated item as the user has checked it: `remember` is set when its
// name was corrected with "remember this correction" on.
type Row = FoodEstimateItem & { remember: boolean }

const readSaved = () => savedFoods(db)
const readProteinTarget = () =>
  currentProfile(db).then((profile) => (profile === undefined ? null : profile.proteinValue))

function problemOf(error: unknown): Problem {
  if (error instanceof NotSignedInError) return 'signIn'
  if (error instanceof ApiRequestError) return error.code === 'ai_capped' ? 'capped' : 'failed'
  return navigator.onLine ? 'failed' : 'offline'
}

// Each photo is shrunk once, however often its estimate is retried.
const encoded = new WeakMap<Blob, Promise<EncodedPhoto>>()
function encodeOnce(photo: Blob): Promise<EncodedPhoto> {
  const known = encoded.get(photo)
  if (known !== undefined) return known
  const next = encodePhoto(photo)
  encoded.set(photo, next)
  return next
}

async function estimate(photo: EncodedPhoto): Promise<Phase> {
  if (api === null) return { kind: 'problem', problem: 'signIn' }
  try {
    const response = await api.request(foodEstimateResponseSchema, {
      method: 'POST',
      path: '/api/food/estimate',
      body: { photo },
    })
    if (response.items.length === 0) return { kind: 'problem', problem: 'noFood' }
    return {
      kind: 'ready',
      dishName: response.dishName,
      items: response.items.map((item) => ({ ...item, remember: false })),
    }
  } catch (error) {
    return { kind: 'problem', problem: problemOf(error) }
  }
}

// When the daily estimate count starts again: the next midnight UTC, the
// server's day for `ai_usage`.
function capResetsAt(): Date {
  const now = new Date()
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1))
}

// The photo estimate (/food/photo, M3-06): the chosen photo with a scan line
// while the estimate runs, then the estimated items to check and log. The meal
// type can be chosen while waiting. Each failure replaces the skeleton rows
// with what happened and a way on ("Photo flow" in docs/design-system.md).
export function PhotoEstimate() {
  const t = useTranslations('photo')
  const tFood = useTranslations('food')
  const locale = useLocale()
  const router = useRouter()
  const whole = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 })
  // The photo and the run of its estimate: a retake or a retry starts a new
  // run, and only the current run's result is shown.
  const [shot, setShot] = useState(() => ({ photo: pendingPhoto(), run: 0 }))
  const { photo } = shot
  const [preview, setPreview] = useState<{ photo: Blob; url: string } | null>(null)
  const [result, setResult] = useState<{ run: number; phase: Phase } | null>(null)
  const phase: Phase = result?.run === shot.run ? result.phase : { kind: 'estimating' }
  const [oilSauce, setOilSauce] = useState<OilSauce>('usual')
  const [correcting, setCorrecting] = useState<{ index: number; item: ItemToCorrect } | null>(null)
  const [mealType, setMealType] = useState<MealType>(() => mealTypeAt(new Date().getHours()))
  const [saving, setSaving] = useState(false)
  const [table, setTable] = useState<readonly FoodTableEntry[] | null>(null)
  const saved = useLiveQuery(readSaved)
  const proteinTarget = useLiveQuery(readProteinTarget)
  const [today] = useState(() => toLocalDate(new Date().toISOString(), deviceTimeZone()))
  const readToday = useCallback(() => foodDay(db, today), [today])
  const day = useLiveQuery(readToday)

  // The handed-over photo is read once; a later visit starts at the picker.
  useEffect(() => {
    setPendingPhoto(null)
  }, [])

  useEffect(() => {
    if (photo === null) return
    let current = true
    const { run } = shot
    void encodeOnce(photo)
      .then((jpeg) => {
        // The shrunk photo is the preview: no object URL to revoke.
        if (current) setPreview({ photo, url: `data:${jpeg.type};base64,${jpeg.base64}` })
        return estimate(jpeg)
      })
      .catch((): Phase => ({ kind: 'problem', problem: 'failed' }))
      .then((next) => {
        if (current) setResult({ run, phase: next })
      })
    return () => {
      current = false
    }
  }, [photo, shot])

  // Names in the user's language come from the food table, with their edits.
  useEffect(() => {
    if (phase.kind !== 'ready' || table !== null) return
    let current = true
    void loadFoodTable().then((entries) => {
      if (current) setTable(entries)
    })
    return () => {
      current = false
    }
  }, [phase.kind, table])

  const retake = (next: Blob) => {
    setShot((current) => ({ photo: next, run: current.run + 1 }))
  }

  const handBy = (
    <PressableLink
      href="/food/add"
      className="rounded-full bg-sunk px-16 py-12 text-center text-body font-semibold text-ink"
    >
      {t('byHand')}
    </PressableLink>
  )

  if (photo === null) {
    return (
      <div className="flex flex-col gap-20">
        <h1 className="text-title">{t('title')}</h1>
        <p className="text-body text-ink-2">{t('noPhoto')}</p>
        <PhotoPicker
          onPick={retake}
          className="rounded-full bg-accent px-16 py-12 text-center text-body font-semibold text-accent-ink"
        >
          {t('choose')}
        </PhotoPicker>
        {handBy}
      </div>
    )
  }

  const library = foodLibrary(table ?? [], saved ?? [], locale === 'zh' ? 'zh' : 'en')
  const byEntry = new Map(
    library.flatMap((food) => (food.tableId === null ? [] : [[food.tableId, food] as const])),
  )
  const entryOf = (item: Row) => (item.entryId === null ? undefined : byEntry.get(item.entryId))
  const nameOf = (item: Row) => entryOf(item)?.name ?? item.name
  const items = phase.kind === 'ready' ? phase.items : []
  const oilKcal = oilSauceKcal(items, oilSauce)
  // The figures as logged: the oil and sauce energy spread over the items.
  const logged = spreadKcal(items, oilKcal)
  const totals = logged.reduce(
    (sum, item) => ({ proteinG: sum.proteinG + item.proteinG, kcal: sum.kcal + item.kcal }),
    { proteinG: 0, kcal: 0 },
  )
  const setItems = (next: Row[]) => {
    if (phase.kind === 'ready') setResult({ run: shot.run, phase: { ...phase, items: next } })
  }
  const setGrams = (index: number, grams: number) => {
    setItems(
      items.map((item, i) => (i === index ? { ...item, ...scalePortion(item, grams) } : item)),
    )
  }

  const correct = (index: number, correction: Correction, remember: boolean) => {
    setItems(
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
  const openCorrection = (index: number, item: Row) => {
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
    if (phase.kind !== 'ready') return
    setSaving(true)
    await logMeal(db, repositories, {
      eatenAt: new Date().toISOString(),
      timeZone: deviceTimeZone(),
      mealType,
      name: phase.dishName,
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

  const problem = phase.kind === 'problem' ? phase.problem : null
  const problemActions = (problem: Problem) => {
    switch (problem) {
      case 'signIn':
        return (
          <PressableLink
            href="/settings/sign-in"
            className="rounded-full bg-ink px-16 py-12 text-center text-body font-semibold text-bg"
          >
            {t('signInAction')}
          </PressableLink>
        )
      case 'failed':
      case 'offline':
        return (
          <Pressable
            onClick={() => {
              setShot((current) => ({ ...current, run: current.run + 1 }))
            }}
            className="rounded-full bg-ink px-16 py-12 text-body font-semibold text-bg"
          >
            {t('retry')}
          </Pressable>
        )
      case 'noFood':
        return (
          <PhotoPicker
            onPick={retake}
            className="rounded-full bg-ink px-16 py-12 text-center text-body font-semibold text-bg"
          >
            {t('retake')}
          </PhotoPicker>
        )
      case 'capped':
        return (
          <PressableLink
            href="/food/add"
            className="rounded-full bg-ink px-16 py-12 text-center text-body font-semibold text-bg"
          >
            {t('frequent')}
          </PressableLink>
        )
    }
  }
  const timeFormat = new Intl.DateTimeFormat(locale, { hour: 'numeric', minute: '2-digit' })
  const afterToday = (day?.totals.proteinG ?? 0) + totals.proteinG

  return (
    <div className="flex flex-col gap-20">
      <header className="flex items-start justify-between gap-12">
        <h1 className="text-title">{t('title')}</h1>
        {phase.kind !== 'estimating' && (
          <PhotoPicker
            onPick={retake}
            className="shrink-0 rounded-full bg-surface px-16 py-8 text-body font-semibold text-ink"
          >
            {t('retake')}
          </PhotoPicker>
        )}
      </header>
      <div className="relative aspect-video overflow-hidden rounded-group bg-sunk">
        {preview?.photo === photo && (
          <div
            role="img"
            aria-label={t('photoAlt')}
            style={{ backgroundImage: `url(${preview.url})` }}
            className="size-full bg-cover bg-center"
          />
        )}
        {phase.kind === 'estimating' && (
          <span
            aria-hidden
            className="absolute inset-0 animate-scan border-t-2 border-accent motion-reduce:hidden"
          />
        )}
        <span className="absolute top-8 left-8 flex items-center gap-8 rounded-full bg-surface px-8 text-label text-ink">
          <span className="text-accent">{t('aiTag')}</span>
          {phase.kind === 'ready' && t('itemCount', { count: items.length })}
        </span>
      </div>
      <ChoiceGroup
        label={t('mealType')}
        options={mealTypeSchema.options}
        value={mealType}
        onChange={setMealType}
        optionLabel={(option) => tFood(`mealType.${option}`)}
      />
      {phase.kind === 'estimating' && (
        <>
          <ul className="flex flex-col gap-12 rounded-group bg-surface p-16" aria-hidden>
            {[0, 1, 2].map((row) => (
              <li key={row} className="flex items-center justify-between gap-12">
                <span className="h-16 w-1/2 rounded-full bg-sunk" />
                <span className="h-16 w-1/5 rounded-full bg-sunk" />
              </li>
            ))}
          </ul>
          <p className="text-label text-ink-3" role="status">
            {t('wait')}
          </p>
          {handBy}
        </>
      )}
      {problem !== null && (
        <section className="flex flex-col gap-12" role="alert">
          <h2 className="text-section">{t(`${problem}.title`)}</h2>
          <p className="text-body text-ink-2">
            {problem === 'capped'
              ? t('capped.body', {
                  count: FOOD_ESTIMATES_PER_DAY,
                  time: timeFormat.format(capResetsAt()),
                })
              : t(`${problem}.body`)}
          </p>
          {problemActions(problem)}
          {handBy}
        </section>
      )}
      {phase.kind === 'ready' && (
        <>
          <section className="flex flex-col gap-4">
            <div className="flex items-end gap-28">
              <p className="flex flex-col">
                <span className="text-label text-ink-3">{t('proteinLabel')}</span>
                <span className="flex items-baseline gap-4">
                  <span className="num text-display text-accent">
                    {whole.format(totals.proteinG)}
                  </span>
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
                    </span>
                    <Pressable
                      aria-label={t('remove', { name })}
                      onClick={() => {
                        setItems(items.filter((_, i) => i !== index))
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
      )}
    </div>
  )
}
