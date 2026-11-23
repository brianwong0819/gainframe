'use client'

import {
  foodEstimateResponseSchema,
  type MealType,
  mealTypeAt,
  mealTypeSchema,
  type PhotoIssue,
} from '@gainframe/shared'
import { useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'

import { api } from '@/sync/backup'
import { ChoiceGroup } from '@/ui/choice-group'
import { Pressable, PressableLink } from '@/ui/pressable'

import { EstimateConfirm, type EstimateRow, toRows } from './estimate-confirm'
import {
  type EstimateProblem,
  ProblemNotice,
  problemActionClass,
  problemOf,
} from './estimate-problem'
import { type EncodedPhoto, encodePhoto, pendingPhoto, setPendingPhoto } from './photo'
import { PhotoPicker } from './photo-picker'

type Phase =
  | { kind: 'estimating' }
  | { kind: 'problem'; problem: EstimateProblem }
  | { kind: 'ready'; dishName: string | null; photoIssue: PhotoIssue | null; items: EstimateRow[] }

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
    if (response.items.length === 0) {
      return { kind: 'problem', problem: response.photoIssue ?? 'no_food' }
    }
    return {
      kind: 'ready',
      dishName: response.dishName,
      photoIssue: response.photoIssue,
      items: toRows(response.items),
    }
  } catch (error) {
    return { kind: 'problem', problem: problemOf(error) }
  }
}

// The photo estimate (/food/photo, M3-06): the chosen photo with a scan line
// while the estimate runs, then the estimated items to check and log. The meal
// type can be chosen while waiting. Each failure replaces the skeleton rows
// with what happened and a way on ("Photo flow" in docs/design-system.md).
export function PhotoEstimate() {
  const t = useTranslations('estimate')
  const tFood = useTranslations('food')
  // The photo and the run of its estimate: a retake or a retry starts a new
  // run, and only the current run's result is shown.
  const [shot, setShot] = useState(() => ({ photo: pendingPhoto(), run: 0 }))
  const { photo } = shot
  const [preview, setPreview] = useState<{ photo: Blob; url: string } | null>(null)
  const [result, setResult] = useState<{ run: number; phase: Phase } | null>(null)
  const phase: Phase = result?.run === shot.run ? result.phase : { kind: 'estimating' }
  const [mealType, setMealType] = useState<MealType>(() => mealTypeAt(new Date().getHours()))

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

  const retake = (next: Blob) => {
    setShot((current) => ({ photo: next, run: current.run + 1 }))
  }

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
        <PressableLink
          href="/food/add"
          className="rounded-full bg-sunk px-16 py-12 text-center text-body font-semibold text-ink"
        >
          {t('byHand')}
        </PressableLink>
      </div>
    )
  }

  // What a problem offers besides signing in and the frequent foods: a retry
  // for a failed request, a retake for a photo the model could not count.
  const problemAction = (problem: EstimateProblem) =>
    problem === 'failed' || problem === 'timeout' || problem === 'offline' ? (
      <Pressable
        onClick={() => {
          setShot((current) => ({ ...current, run: current.run + 1 }))
        }}
        className={problemActionClass}
      >
        {t('retry')}
      </Pressable>
    ) : (
      <PhotoPicker onPick={retake} className={problemActionClass}>
        {t('retake')}
      </PhotoPicker>
    )

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
          {phase.kind === 'ready' && t('itemCount', { count: phase.items.length })}
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
          <EstimateSkeleton />
          <p className="text-label text-ink-3" role="status">
            {t('wait')}
          </p>
          <PressableLink
            href="/food/add"
            className="rounded-full bg-sunk px-16 py-12 text-center text-body font-semibold text-ink"
          >
            {t('byHand')}
          </PressableLink>
        </>
      )}
      {phase.kind === 'problem' && (
        <ProblemNotice problem={phase.problem} action={problemAction(phase.problem)} />
      )}
      {phase.kind === 'ready' && (
        <EstimateConfirm
          dishName={phase.dishName}
          items={phase.items}
          onItemsChange={(items) => {
            setResult({ run: shot.run, phase: { ...phase, items } })
          }}
          mealType={mealType}
          notice={
            phase.photoIssue !== null &&
            phase.photoIssue !== 'no_food' && (
              <p className="text-body text-ink-2">{t(`issueNote.${phase.photoIssue}`)}</p>
            )
          }
        />
      )}
    </div>
  )
}

// Rows standing in for the items while the estimate runs.
export function EstimateSkeleton() {
  return (
    <ul className="flex flex-col gap-12 rounded-group bg-surface p-16" aria-hidden>
      {[0, 1, 2].map((row) => (
        <li key={row} className="flex items-center justify-between gap-12">
          <span className="h-16 w-1/2 rounded-full bg-sunk" />
          <span className="h-16 w-1/5 rounded-full bg-sunk" />
        </li>
      ))}
    </ul>
  )
}
