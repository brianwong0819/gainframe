'use client'

import { muscleZone, TRAINED_MUSCLES } from '@gainframe/shared'
import { useTranslations } from 'next-intl'
import Link from 'next/link'

import { MuscleMap } from '@/features/exercises/muscle-map'
import { Chevron } from '@/ui/chevron'
import { PressableLink } from '@/ui/pressable'
import { Verdict } from '@/ui/verdict'

import { figureSummary, muscleLevels, useSetsFormat } from './muscle-section'
import { useMuscleWeek } from './use-muscle-week'

/**
 * The volume card of the Progress page ("Muscle map" in
 * docs/design-system.md): the last seven days' sets, how many groups are in
 * the target zone and the low group, beside the small figure; it opens the
 * volume page. Before any workout it is the untinted figure with a button to
 * the Workout tab.
 */
export function VolumeCard() {
  const t = useTranslations('progress.volume')
  const tMuscle = useTranslations('muscle')
  const formatSets = useSetsFormat()
  const week = useMuscleWeek()
  if (week === undefined) return null
  const { volume, direct } = week
  const figure = (
    <div className="w-2/5 shrink-0">
      <MuscleMap
        levels={muscleLevels(volume)}
        label={t('figureLabel', { summary: figureSummary(volume, tMuscle, formatSets) })}
      />
    </div>
  )

  if (!week.everTrained) {
    return (
      <section className="flex flex-col gap-12 rounded-group bg-surface p-16">
        <h2 className="text-label text-ink-2">{t('heading')}</h2>
        <div className="flex items-center gap-16">
          <p className="flex-1 text-body text-ink-2">{t('empty')}</p>
          {figure}
        </div>
        <PressableLink
          href="/workout"
          className="rounded-full bg-sunk px-16 py-12 text-center text-body font-semibold text-ink"
        >
          {t('start')}
        </PressableLink>
      </section>
    )
  }

  const zones = TRAINED_MUSCLES.map((muscle) => ({
    muscle,
    zone: muscleZone(volume[muscle].sets, direct.has(muscle)),
  }))
  const inTarget = zones.filter(({ zone }) => zone === 'target').length
  const low = zones
    .filter(({ zone }) => zone === 'low')
    .toSorted((a, b) => volume[a.muscle].sets - volume[b.muscle].sets)[0]
  const targetText = inTarget > 0 ? t('inTarget', { count: inTarget }) : t('noneInTarget')

  return (
    <Link href="/progress/volume" className="flex flex-col gap-4 rounded-group bg-surface p-16">
      <div className="flex items-center justify-between gap-12 text-label text-ink-2">
        <h2>{t('heading')}</h2>
        <Chevron direction="right" />
      </div>
      <div className="flex items-center gap-16">
        <div className="flex flex-1 flex-col gap-4">
          <p className="flex items-baseline gap-4 pt-4">
            <span className="num text-title">{week.setsDone.toString()}</span>
            <span className="text-label text-ink-2">{t('setsUnit')}</span>
          </p>
          {low ? (
            <Verdict tone="attention" word={t('low', { muscle: tMuscle(low.muscle) })}>
              {targetText}
            </Verdict>
          ) : (
            <Verdict tone={inTarget > 0 ? 'ok' : 'plain'} word={targetText} />
          )}
        </div>
        {figure}
      </div>
    </Link>
  )
}
