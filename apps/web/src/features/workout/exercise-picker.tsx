'use client'

import { useLocale, useTranslations } from 'next-intl'
import { useState } from 'react'

import { Pressable } from '@/ui/pressable'
import { SheetBack } from '@/ui/sheet-back'

import { ExerciseForm } from '../exercises/exercise-form'
import {
  type ExerciseDraft,
  exerciseName,
  type LibraryEntry,
  libraryEntries,
  newDraft,
} from '../exercises/library'
import { useCustomExercises } from '../exercises/use-custom-exercises'

// The exercise library as a list to pick from, with the same search. An
// exercise missing from the library is created here, with the library's form
// named after the search, and handed to `onCreated` once saved. The list stays
// mounted while the form shows, so its search survives "back".
export function ExercisePicker({
  onPick,
  onCreated,
}: {
  onPick: (exercise: LibraryEntry) => void
  onCreated: (exercise: LibraryEntry) => void
}) {
  const t = useTranslations('exercises')
  const tMuscle = useTranslations('muscle')
  const locale = useLocale()
  const custom = useCustomExercises()
  const [query, setQuery] = useState('')
  const [creating, setCreating] = useState<ExerciseDraft | null>(null)
  const entries = libraryEntries(custom ?? [], null, query)
  const named = query.trim()

  return (
    <>
      <div hidden={creating !== null} className="flex flex-col gap-12">
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
          className="w-full rounded-ctl bg-bg px-16 py-12 text-input text-ink placeholder:text-ink-3"
        />
        {entries.length > 0 ? (
          <ul aria-label={t('listLabel')}>
            {entries.map((entry) => (
              <li key={entry.id} className="border-t border-line first:border-t-0">
                <Pressable
                  className="flex w-full flex-col py-12 text-left"
                  onClick={() => {
                    onPick(entry)
                  }}
                >
                  <span className="text-body text-ink">{exerciseName(entry, locale)}</span>
                  <span className="text-label text-ink-3">{tMuscle(entry.muscle)}</span>
                </Pressable>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-body text-ink-2">{t('empty', { query: named })}</p>
        )}
        {named !== '' && (
          <Pressable
            onClick={() => {
              setCreating(newDraft(named, null))
            }}
            className="self-start rounded-full bg-sunk px-16 py-12 text-label font-semibold text-ink"
          >
            {t('createNamed', { query: named })}
          </Pressable>
        )}
      </div>
      {creating && (
        <div className="flex flex-col gap-16">
          <SheetBack
            label={t('backToList')}
            onBack={() => {
              setCreating(null)
            }}
          />
          <ExerciseForm
            editing={null}
            initial={creating}
            onDone={(exercise) => {
              setCreating(null)
              onCreated({ ...exercise, custom: true })
            }}
          />
        </div>
      )}
    </>
  )
}
