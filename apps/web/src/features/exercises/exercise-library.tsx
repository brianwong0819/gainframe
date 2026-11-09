'use client'

import {
  BUILT_IN_EXERCISES,
  type Exercise,
  type MuscleGroup,
  muscleGroupSchema,
} from '@gainframe/shared'
import { useLocale, useTranslations } from 'next-intl'
import Link from 'next/link'
import { useState } from 'react'

import { Chevron } from '@/ui/chevron'
import { Pressable } from '@/ui/pressable'
import { Sheet } from '@/ui/sheet'

import { ExerciseForm } from './exercise-form'
import {
  type ExerciseDraft,
  exerciseName,
  formatRest,
  type LibraryEntry,
  libraryEntries,
} from './library'
import { useCustomExercises } from './use-custom-exercises'

const chipClass =
  'shrink-0 rounded-full border border-line px-16 py-8 text-label text-ink-2 aria-pressed:border-ink aria-pressed:bg-ink aria-pressed:text-bg'

const han = /\p{Script=Han}/u

interface Editing {
  exercise: Exercise | null
  initial: ExerciseDraft
}

function newDraft(name: string, muscle: MuscleGroup | null): ExerciseDraft {
  const trimmed = name.trim()
  return {
    nameZh: han.test(trimmed) ? trimmed : '',
    nameEn: han.test(trimmed) ? '' : trimmed,
    muscle: muscle ?? 'chest',
    equipment: 'barbell',
    defaultRestS: 90,
  }
}

function EntryRow({
  entry,
  onEdit,
}: {
  entry: LibraryEntry
  onEdit: (exercise: Exercise) => void
}) {
  const t = useTranslations('exercises')
  const tMuscle = useTranslations('muscle')
  const tEquipment = useTranslations('equipment')
  const locale = useLocale()
  const content = (
    <>
      <span className="flex min-w-0 flex-col">
        <span className="text-body text-ink">{exerciseName(entry, locale)}</span>
        <span className="text-label text-ink-3">
          {tMuscle(entry.muscle)} · {tEquipment(entry.equipment)}
          {entry.custom && ` · ${t('custom')}`}
        </span>
      </span>
      <span
        className="num shrink-0 text-label text-ink-2"
        aria-label={t('restLabel', { rest: formatRest(entry.defaultRestS) })}
      >
        {formatRest(entry.defaultRestS)}
      </span>
    </>
  )
  const rowClass = 'flex w-full items-center justify-between gap-12 py-12 text-left'
  return (
    <li className="border-t border-line first:border-t-0">
      {entry.custom ? (
        <Pressable
          className={rowClass}
          onClick={() => {
            onEdit(entry)
          }}
        >
          {content}
        </Pressable>
      ) : (
        <div className={rowClass}>{content}</div>
      )}
    </li>
  )
}

export function ExerciseLibrary() {
  const t = useTranslations('exercises')
  const tForm = useTranslations('exerciseForm')
  const tMuscle = useTranslations('muscle')
  const custom = useCustomExercises()
  const [query, setQuery] = useState('')
  const [muscle, setMuscle] = useState<MuscleGroup | null>(null)
  const [editing, setEditing] = useState<Editing | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)

  const entries = libraryEntries(custom ?? [], muscle, query)
  const total = BUILT_IN_EXERCISES.length + (custom?.length ?? 0)

  function open(next: Editing) {
    setEditing(next)
    setSheetOpen(true)
  }

  function edit(exercise: Exercise) {
    open({
      exercise,
      initial: {
        nameZh: exercise.nameZh ?? '',
        nameEn: exercise.nameEn ?? '',
        muscle: exercise.muscle,
        equipment: exercise.equipment,
        defaultRestS: exercise.defaultRestS,
      },
    })
  }

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
        <div className="flex items-end justify-between gap-12">
          <div className="flex flex-col gap-4">
            <h1 className="text-title">{t('title')}</h1>
            <p className="text-label text-ink-2">{t('count', { count: total })}</p>
          </div>
          <Pressable
            onClick={() => {
              open({ exercise: null, initial: newDraft('', muscle) })
            }}
            className="rounded-full bg-sunk px-16 py-12 text-label font-semibold text-ink"
          >
            {t('new')}
          </Pressable>
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
              <EntryRow key={entry.id} entry={entry} onEdit={edit} />
            ))}
          </ul>
        ) : (
          <div className="flex flex-col items-start gap-12 rounded-group bg-surface p-16">
            <p className="text-body text-ink-2">{t('empty', { query: query.trim() })}</p>
            {query.trim() !== '' && (
              <Pressable
                onClick={() => {
                  open({ exercise: null, initial: newDraft(query, muscle) })
                }}
                className="rounded-full bg-sunk px-16 py-12 text-label font-semibold text-ink"
              >
                {t('createNamed', { query: query.trim() })}
              </Pressable>
            )}
          </div>
        ))}

      <Sheet
        open={sheetOpen}
        onClose={() => {
          setSheetOpen(false)
        }}
        title={editing?.exercise ? tForm('editTitle') : tForm('newTitle')}
      >
        {editing && (
          <ExerciseForm
            key={editing.exercise?.id ?? 'new'}
            editing={editing.exercise}
            initial={editing.initial}
            onDone={() => {
              setSheetOpen(false)
            }}
          />
        )}
      </Sheet>
    </main>
  )
}
