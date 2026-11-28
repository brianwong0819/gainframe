'use client'

import {
  type FoodEstimateResponse,
  type MealType,
  mealTypeAt,
  mealTypeSchema,
  type PhotoIssue,
} from '@gainframe/shared'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { type ReactNode, useCallback, useEffect, useState } from 'react'

import { db } from '@/db/client'
import { discardPhoto, keepPhoto, recordPhotoEstimate } from '@/db/pending-photos'
import type { PendingPhoto } from '@/db/schema'
import { useLiveQuery } from '@/db/use-live-query'
import { deviceTimeZone } from '@/i18n/time-zone'
import { api } from '@/sync/backup'
import { ChoiceGroup } from '@/ui/choice-group'
import { ConfirmButton } from '@/ui/confirm-button'
import { Pressable, PressableLink } from '@/ui/pressable'
import { useIdFromHash } from '@/ui/use-id-from-hash'

import { EstimateConfirm, type EstimateRow, toRows } from './estimate-confirm'
import { type EstimateProblem, problemOf } from './estimate-error'
import { ProblemNotice, problemActionClass } from './estimate-problem'
import { type EncodedPhoto, encodePhoto, pendingPhoto, setPendingPhoto } from './photo'
import { PhotoPicker } from './photo-picker'
import { requestPhotoEstimate } from './photo-request'

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

const dataUrl = (photo: EncodedPhoto) => `data:${photo.type};base64,${photo.base64}`

const retryable = (problem: EstimateProblem) =>
  problem === 'failed' || problem === 'timeout' || problem === 'offline'

const readyPhase = ({ dishName, photoIssue, items }: FoodEstimateResponse): Phase => ({
  kind: 'ready',
  dishName,
  photoIssue,
  items: toRows(items),
})

async function estimate(photo: EncodedPhoto): Promise<Phase> {
  const result = await requestPhotoEstimate(api, photo)
  return result.kind === 'problem' ? result : readyPhase(result.response)
}

// The photo estimate (/food/photo, M3-06): the chosen photo with a scan line
// while the estimate runs, then the estimated items to check and log. The meal
// type can be chosen while waiting. Each failure replaces the skeleton rows
// with what happened and a way on ("Photo flow" in docs/design-system.md).
// `/food/photo#<id>` opens a photo kept while offline (M3-03).
export function PhotoEstimate() {
  const keptId = useIdFromHash()
  if (keptId === undefined) return null
  return keptId === null ? <NewPhotoEstimate /> : <KeptPhotoEstimate key={keptId} id={keptId} />
}

function NewPhotoEstimate() {
  const t = useTranslations('estimate')
  const router = useRouter()
  // The photo, when it was chosen and the run of its estimate: a retake or a
  // retry starts a new run, and only the current run's result is shown.
  const [shot, setShot] = useState(() => ({
    photo: pendingPhoto(),
    takenAt: new Date().toISOString(),
    run: 0,
  }))
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
        if (current) setPreview({ photo, url: dataUrl(jpeg) })
        return estimate(jpeg)
      })
      .catch((error: unknown): Phase => ({ kind: 'problem', problem: problemOf(error) }))
      .then((next) => {
        if (current) setResult({ run, phase: next })
      })
    return () => {
      current = false
    }
  }, [photo, shot])

  const retake = (next: Blob) => {
    setShot((current) => ({ photo: next, takenAt: new Date().toISOString(), run: current.run + 1 }))
  }

  if (photo === null) {
    return (
      <div className="flex flex-col gap-20">
        <h1 className="text-title">{t('title')}</h1>
        <div className="flex flex-col gap-4">
          <p className="text-body text-ink-2">{t('noPhoto')}</p>
          <p className="text-label text-ink-3">{t('photoTip')}</p>
        </div>
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
          {t('manual')}
        </PressableLink>
      </div>
    )
  }

  const retry = (
    <Pressable
      onClick={() => {
        setShot((current) => ({ ...current, run: current.run + 1 }))
      }}
      className={problemActionClass}
    >
      {t('retry')}
    </Pressable>
  )
  // Offline, the photo can wait on the device for the next connection.
  const keep = (
    <Pressable
      onClick={() => {
        void encodeOnce(photo)
          .then((jpeg) =>
            keepPhoto(db, {
              takenAt: shot.takenAt,
              timeZone: deviceTimeZone(),
              mealType,
              photo: jpeg,
            }),
          )
          .then(() => {
            router.push('/food')
          })
      }}
      className={problemActionClass}
    >
      {t('keep')}
    </Pressable>
  )
  // What a problem offers besides signing in and the frequent foods: a retry
  // for a failed request, a retake for a photo the model could not count.
  const problemAction = (problem: EstimateProblem) =>
    problem === 'offline' ? (
      keep
    ) : retryable(problem) ? (
      retry
    ) : (
      <PhotoPicker onPick={retake} className={problemActionClass}>
        {t('retake')}
      </PhotoPicker>
    )

  return (
    <PhotoEstimateView
      previewUrl={preview?.photo === photo ? preview.url : null}
      phase={phase}
      onItemsChange={(items) => {
        if (phase.kind === 'ready') setResult({ run: shot.run, phase: { ...phase, items } })
      }}
      mealType={mealType}
      onMealType={setMealType}
      headerAction={
        <PhotoPicker
          onPick={retake}
          className="shrink-0 rounded-full bg-surface px-16 py-8 text-body font-semibold text-ink"
        >
          {t('retake')}
        </PhotoPicker>
      }
      problemAction={problemAction}
    />
  )
}

// What a kept photo shows before a run on this screen: its stored estimate,
// why its estimate stopped, or nothing yet.
function storedPhase(row: PendingPhoto): Phase | null {
  if (row.estimate !== null) return readyPhase(row.estimate)
  return row.stoppedBy === null ? null : { kind: 'problem', problem: row.stoppedBy }
}

// A photo kept while offline (M3-03), opened from its row on the Food tab. Its
// estimate usually ran in the background; when it has not, it runs here. The
// meal is logged at the time the photo was taken, and the photo can be
// discarded instead.
function KeptPhotoEstimate({ id }: { id: string }) {
  const t = useTranslations('estimate')
  const router = useRouter()
  const read = useCallback(() => db.pendingPhotos.get(id).then((row) => row ?? null), [id])
  const row = useLiveQuery(read)
  // Run 0 shows what the row holds; each retry is a further run.
  const [run, setRun] = useState(0)
  const [result, setResult] = useState<{ run: number; phase: Phase } | null>(null)
  const [mealType, setMealType] = useState<MealType | null>(null)
  const stored = row ? storedPhase(row) : null
  const needsRun = run > 0 || (row !== undefined && row !== null && stored === null)

  useEffect(() => {
    if (!needsRun) return
    let current = true
    void db.pendingPhotos
      .get(id)
      .then(async (kept): Promise<Phase | null> => {
        if (kept === undefined) return null
        const result = await requestPhotoEstimate(api, kept.photo)
        if (result.kind === 'problem') return result
        await recordPhotoEstimate(db, id, { estimate: result.response, stoppedBy: null })
        return readyPhase(result.response)
      })
      .then((next) => {
        if (current && next !== null) setResult({ run, phase: next })
      })
    return () => {
      current = false
    }
  }, [id, run, needsRun])

  if (row === undefined) return null
  if (row === null) {
    return (
      <div className="flex flex-col gap-20">
        <h1 className="text-title">{t('title')}</h1>
        <p className="text-body text-ink-2">{t('keptGone')}</p>
      </div>
    )
  }

  const phase: Phase =
    result?.run === run ? result.phase : ((run === 0 ? stored : null) ?? { kind: 'estimating' })
  const discard = () => {
    void discardPhoto(db, id).then(() => {
      router.push('/food')
    })
  }
  return (
    <PhotoEstimateView
      previewUrl={dataUrl(row.photo)}
      phase={phase}
      onItemsChange={(items) => {
        if (phase.kind === 'ready') setResult({ run, phase: { ...phase, items } })
      }}
      mealType={mealType ?? row.mealType}
      onMealType={setMealType}
      problemAction={(problem) =>
        retryable(problem) ? (
          <Pressable
            onClick={() => {
              setRun((current) => current + 1)
            }}
            className={problemActionClass}
          >
            {t('retry')}
          </Pressable>
        ) : null
      }
      kept={{ id, takenAt: row.takenAt }}
      footer={
        <ConfirmButton
          label={t('discard')}
          confirmLabel={t('discardConfirm')}
          onConfirm={discard}
        />
      }
    />
  )
}

function PhotoEstimateView({
  previewUrl,
  phase,
  onItemsChange,
  mealType,
  onMealType,
  headerAction,
  problemAction,
  kept,
  footer,
}: {
  previewUrl: string | null
  phase: Phase
  onItemsChange: (items: EstimateRow[]) => void
  mealType: MealType
  onMealType: (mealType: MealType) => void
  headerAction?: ReactNode
  problemAction: (problem: EstimateProblem) => ReactNode
  kept?: { id: string; takenAt: string }
  footer?: ReactNode
}) {
  const t = useTranslations('estimate')
  const tFood = useTranslations('food')
  return (
    <div className="flex flex-col gap-20">
      <header className="flex items-start justify-between gap-12">
        <h1 className="text-title">{t('title')}</h1>
        {phase.kind !== 'estimating' && headerAction}
      </header>
      <div className="relative aspect-video overflow-hidden rounded-group bg-sunk">
        {previewUrl !== null && (
          <div
            role="img"
            aria-label={t('photoAlt')}
            style={{ backgroundImage: `url(${previewUrl})` }}
            className="size-full bg-cover bg-center"
          />
        )}
        {phase.kind === 'estimating' && (
          <span
            aria-hidden
            className="absolute inset-0 animate-scan border-t-2 border-accent motion-reduce:hidden"
          />
        )}
        <span className="layer-opaque absolute top-8 left-8 flex items-center gap-8 rounded-full bg-surface px-8 text-label text-ink">
          <span className="text-accent">{t('aiTag')}</span>
          {phase.kind === 'ready' && t('itemCount', { count: phase.items.length })}
        </span>
      </div>
      <ChoiceGroup
        label={t('mealType')}
        options={mealTypeSchema.options}
        value={mealType}
        onChange={onMealType}
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
          onItemsChange={onItemsChange}
          mealType={mealType}
          notice={
            phase.photoIssue !== null &&
            phase.photoIssue !== 'no_food' && (
              <p className="text-body text-ink-2">{t(`issueNote.${phase.photoIssue}`)}</p>
            )
          }
          {...(kept === undefined ? {} : { kept })}
        />
      )}
      {footer}
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
