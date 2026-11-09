'use client'

import { useLocale, useTranslations } from 'next-intl'
import { useState } from 'react'

import { Pressable } from '@/ui/pressable'

import { exerciseName, libraryEntries } from '../exercises/library'
import { useCustomExercises } from '../exercises/use-custom-exercises'

// The exercise library as a list to pick from, with the same search.
export function ExercisePicker({ onPick }: { onPick: (exerciseId: string) => void }) {
  const t = useTranslations('exercises')
  const tMuscle = useTranslations('muscle')
  const locale = useLocale()
  const custom = useCustomExercises()
  const [query, setQuery] = useState('')
  const entries = libraryEntries(custom ?? [], null, query)

  return (
    <div className="flex flex-col gap-12">
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
                  onPick(entry.id)
                }}
              >
                <span className="text-body text-ink">{exerciseName(entry, locale)}</span>
                <span className="text-label text-ink-3">{tMuscle(entry.muscle)}</span>
              </Pressable>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-body text-ink-2">{t('empty', { query: query.trim() })}</p>
      )}
    </div>
  )
}
