'use client'

import {
  domainConfig,
  type Exercise,
  type MuscleVolume,
  type MuscleZone,
  muscleHeat,
  muscleZone,
  startingMuscle,
  TRAINED_MUSCLES,
  type TrainedMuscle,
} from '@gainframe/shared'
import { useLocale, useTranslations } from 'next-intl'
import { useState } from 'react'

import { exerciseName, findLibraryEntry } from '@/features/exercises/library'
import { type MuscleLevels, MuscleMap } from '@/features/exercises/muscle-map'
import { formatShortDay } from '@/features/history/dates'
import { PressableLink, Pressable } from '@/ui/pressable'

import { type MuscleWeek, useMuscleWeek } from './use-muscle-week'

// The rows' track runs from 0 to this many sets, a little past the target zone.
const TRACK_MAX_SETS = 24

const heatClass = ['bg-heat-0', 'bg-heat-1', 'bg-heat-2', 'bg-accent'] as const

const zoneClass: Record<MuscleZone, string> = {
  none: 'text-ink-3',
  indirect: 'text-ink-2',
  low: 'text-short',
  effective: 'text-ink-2',
  target: 'text-accent',
  high: 'text-ink-2',
}

const tagClass: Record<MuscleZone, string> = {
  none: 'bg-sunk text-ink-3',
  indirect: 'bg-sunk text-ink-2',
  low: 'bg-short-wash text-short',
  effective: 'bg-sunk text-ink-2',
  target: 'bg-accent-wash text-accent',
  high: 'bg-sunk text-ink-2',
}

/** Each group's fill on the figure, from its sets. */
export function muscleLevels(volume: Record<TrainedMuscle, MuscleVolume>): MuscleLevels {
  return Object.fromEntries(
    TRAINED_MUSCLES.map((muscle) => [muscle, muscleHeat(volume[muscle].sets)]),
  )
}

/** The figure's accessible text: every group with its sets. */
export function figureSummary(
  volume: Record<TrainedMuscle, MuscleVolume>,
  muscleName: (muscle: TrainedMuscle) => string,
  formatSets: (sets: number) => string,
): string {
  return TRAINED_MUSCLES.map(
    (muscle) => `${muscleName(muscle)} ${formatSets(volume[muscle].sets)}`,
  ).join(', ')
}

export function useSetsFormat(): (sets: number) => string {
  const locale = useLocale()
  const format = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 })
  return (sets) => format.format(sets)
}

/** The figure's four fills with their meaning. */
export function MuscleLegend() {
  const t = useTranslations('progress.muscles')
  const keys = ['none', 'low', 'effective', 'target'] as const
  return (
    <ul
      aria-label={t('legendLabel')}
      className="flex flex-wrap justify-center gap-x-12 gap-y-4 text-caption text-ink-2"
    >
      {keys.map((key, level) => (
        <li key={key} className="flex items-center gap-4">
          <span aria-hidden className={`size-8 rounded-full ${heatClass[level] ?? ''}`} />
          {t(`legend.${key}`)}
        </li>
      ))}
    </ul>
  )
}

/**
 * The "By muscle" section of the volume page ("Muscle map" in
 * docs/design-system.md): the tinted figure, the selected group's card and
 * every group as a row. The rows are the control that always works; tapping
 * the figure selects the same row.
 */
export function MuscleSection() {
  const week = useMuscleWeek()
  if (week === undefined) return null
  return <MuscleSectionView week={week} />
}

function MuscleSectionView({ week }: { week: MuscleWeek }) {
  const t = useTranslations('progress.muscles')
  const tVolume = useTranslations('progress.volume')
  const tMuscle = useTranslations('muscle')
  const locale = useLocale()
  const formatSets = useSetsFormat()
  const [picked, setPicked] = useState<TrainedMuscle | null>(null)
  const { volume, direct } = week
  const selected = picked ?? startingMuscle(volume, direct)
  const zoneOf = (muscle: TrainedMuscle) => muscleZone(volume[muscle].sets, direct.has(muscle))

  return (
    <section aria-labelledby="muscles-heading" className="flex flex-col gap-12">
      <div className="flex items-baseline justify-between gap-12">
        <h2 id="muscles-heading" className="text-section">
          {t('heading')}
        </h2>
        <span className="text-label text-ink-2">
          {t('range', {
            from: formatShortDay(week.from, locale),
            to: formatShortDay(week.to, locale),
          })}
        </span>
      </div>

      <div className="flex flex-col gap-12 rounded-group bg-surface p-16">
        <p className="flex justify-around text-caption text-ink-3" aria-hidden>
          <span>{t('front')}</span>
          <span>{t('back')}</span>
        </p>
        <MuscleMap
          levels={muscleLevels(volume)}
          selected={selected}
          label={tVolume('figureLabel', { summary: figureSummary(volume, tMuscle, formatSets) })}
          onPick={setPicked}
        />
        <MuscleLegend />
      </div>

      <SelectedCard
        muscle={selected}
        volume={volume[selected]}
        zone={zoneOf(selected)}
        custom={week.custom}
      />

      <div className="flex flex-col rounded-group bg-surface px-16 py-4">
        <ul aria-label={t('rowsLabel')}>
          {TRAINED_MUSCLES.map((muscle) => {
            const { sets } = volume[muscle]
            const zone = zoneOf(muscle)
            const on = muscle === selected
            return (
              <li key={muscle} className="border-b border-line">
                <Pressable
                  aria-pressed={on}
                  aria-label={t('rowLabel', {
                    muscle: tMuscle(muscle),
                    sets: formatSets(sets),
                    zone: t(`zone.${zone}`),
                  })}
                  onClick={() => {
                    setPicked(muscle)
                  }}
                  className="grid w-full grid-cols-[3fr_6fr_2fr_3fr] items-center gap-8 py-16 text-left"
                >
                  <span className={`text-body ${on ? 'font-semibold' : ''}`}>
                    {tMuscle(muscle)}
                  </span>
                  <span className="relative h-8 overflow-hidden rounded-full bg-sunk">
                    <span
                      className="absolute inset-y-0 bg-accent-wash"
                      style={{
                        left: `${((domainConfig.muscleVolume.zones.target / TRACK_MAX_SETS) * 100).toString()}%`,
                        width: `${(((domainConfig.muscleVolume.zones.high - domainConfig.muscleVolume.zones.target) / TRACK_MAX_SETS) * 100).toString()}%`,
                      }}
                    />
                    <span
                      className={`absolute inset-y-0 left-0 rounded-full ${heatClass[Math.max(1, muscleHeat(sets))] ?? ''}`}
                      style={{
                        width: `${Math.min(100, (sets / TRACK_MAX_SETS) * 100).toString()}%`,
                      }}
                    />
                  </span>
                  <span className="num text-right text-body">{formatSets(sets)}</span>
                  <span className={`text-right text-label ${zoneClass[zone]}`}>
                    {t(`zone.${zone}`)}
                  </span>
                </Pressable>
              </li>
            )
          })}
        </ul>
        <p className="py-12 text-label text-ink-3">{t('footnote')}</p>
      </div>
    </section>
  )
}

function SelectedCard({
  muscle,
  volume,
  zone,
  custom,
}: {
  muscle: TrainedMuscle
  volume: MuscleVolume
  zone: MuscleZone
  custom: readonly Exercise[]
}) {
  const t = useTranslations('progress.muscles')
  const tMuscle = useTranslations('muscle')
  const locale = useLocale()
  const formatSets = useSetsFormat()
  const { effective, target } = domainConfig.muscleVolume.zones
  const name = tMuscle(muscle)
  return (
    <div aria-live="polite" className="flex flex-col gap-12 rounded-group bg-surface p-16">
      <div className="flex items-center justify-between gap-12">
        <h3 className="text-body font-semibold">{name}</h3>
        <span className={`rounded-full px-8 text-label ${tagClass[zone]}`}>
          {t(`zone.${zone}`)}
        </span>
      </div>
      <p className="flex items-baseline gap-8">
        <span className="num text-title">{formatSets(volume.sets)}</span>
        <span className="text-body text-ink-2">{t('targetNote')}</span>
      </p>
      <p className="text-body text-ink-2">
        {t(`line.${zone}`, {
          sets: formatSets(volume.sets),
          toEffective: formatSets(effective - volume.sets),
          toTarget: formatSets(target - volume.sets),
        })}
      </p>
      {volume.contributions.length > 0 && (
        <div className="flex flex-col gap-8 border-t border-line pt-12">
          <h4 className="text-label text-ink-3">{t('counted')}</h4>
          <ul className="flex flex-col gap-8">
            {volume.contributions.map(({ exerciseId, sets, share }) => {
              const entry = findLibraryEntry(exerciseId, custom)
              return (
                <li key={exerciseId} className="flex justify-between gap-12 text-body">
                  <span>{entry ? exerciseName(entry, locale) : ''}</span>
                  <span className="shrink-0 text-ink-2">
                    {t('countedSets', { sets: formatSets(sets) })}
                    {share < 1 && t('half')}
                  </span>
                </li>
              )
            })}
          </ul>
        </div>
      )}
      <PressableLink
        href={`/workout/exercises#${muscle}`}
        className="mt-4 rounded-full bg-sunk px-16 py-12 text-center text-body font-semibold text-ink"
      >
        {t('find', { muscle: name })}
      </PressableLink>
    </div>
  )
}
