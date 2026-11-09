'use client'

import { BUILT_IN_EXERCISES, type MuscleGroup, muscleGroupSchema } from '@gainframe/shared'
import { useLocale, useTranslations } from 'next-intl'
import Link from 'next/link'
import { useState } from 'react'

import { Chevron } from '@/ui/chevron'
import { Pressable } from '@/ui/pressable'

import { exerciseName, formatRest, type LibraryEntry, libraryEntries } from './library'
import { useCustomExercises } from './use-custom-exercises'

const chipClass =
  'shrink-0 rounded-full border border-line px-16 py-8 text-label text-ink-2 aria-pressed:border-ink aria-pressed:bg-ink aria-pressed:text-bg'

function EntryRow({ entry }: { entry: LibraryEntry }) {
  const t = useTranslations('exercises')
  const tMuscle = useTranslations('muscle')
  const tEquipment = useTranslations('equipment')
  const locale = useLocale()
  const rest = formatRest(entry.defaultRestS)
  return (
    <li className="flex items-center justify-between gap-12 border-t border-line py-12 first:border-t-0">
      <span className="flex min-w-0 flex-col">
        <span className="text-body text-ink">{exerciseName(entry, locale)}</span>
        <span className="text-label text-ink-3">
          {tMuscle(entry.muscle)} · {tEquipment(entry.equipment)}
          {entry.custom && ` · ${t('custom')}`}
        </span>
      </span>
      <span className="num shrink-0 text-label text-ink-2" aria-label={t('restLabel', { rest })}>
        {rest}
      </span>
    </li>
  )
}

export function ExerciseLibrary() {
  const t = useTranslations('exercises')
  const tMuscle = useTranslations('muscle')
  const custom = useCustomExercises()
  const [query, setQuery] = useState('')
  const [muscle, setMuscle] = useState<MuscleGroup | null>(null)

  const entries = libraryEntries(custom ?? [], muscle, query)
  const total = BUILT_IN_EXERCISES.length + (custom?.length ?? 0)

  return (
    <main className="flex flex-col gap-20">
      <header className="flex flex-col gap-8">
        <Link
          href="/workout"
          className="flex items-center gap-4 self-start py-8 text-label text-ink-2"
        >
          <Chevron direction="left" />
          {t('back')}
        </Link>
        <div className="flex flex-col gap-4">
          <h1 className="text-title">{t('title')}</h1>
          <p className="text-label text-ink-2">{t('count', { count: total })}</p>
        </div>
      </header>

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

      <div role="group" aria-label={t('filterLabel')} className="flex gap-8 overflow-x-auto">
        {[null, ...muscleGroupSchema.options].map((option) => (
          <Pressable
            key={option ?? 'all'}
            aria-pressed={option === muscle}
            onClick={() => {
              setMuscle(option)
            }}
            className={chipClass}
          >
            {option === null ? t('all') : tMuscle(option)}
          </Pressable>
        ))}
      </div>

      {custom !== undefined &&
        (entries.length > 0 ? (
          <ul className="rounded-group bg-surface px-16" aria-label={t('listLabel')}>
            {entries.map((entry) => (
              <EntryRow key={entry.id} entry={entry} />
            ))}
          </ul>
        ) : (
          <p className="rounded-group bg-surface p-16 text-body text-ink-2">
            {t('empty', { query: query.trim() })}
          </p>
        ))}
    </main>
  )
}
