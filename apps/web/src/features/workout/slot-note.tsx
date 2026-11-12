'use client'

import type { WorkoutExercise } from '@gainframe/shared'
import { useTranslations } from 'next-intl'
import { useId, useState } from 'react'

import { repositories } from '@/db/client'
import { Pressable } from '@/ui/pressable'

const NOTE_MAX = 500

// The note for one exercise in this workout (seat height, grip, how it felt),
// and removing the exercise with its sets.
export function SlotNote({ slot, onDone }: { slot: WorkoutExercise; onDone: () => void }) {
  const t = useTranslations('workout')
  const id = useId()
  const [note, setNote] = useState(slot.note ?? '')

  return (
    <form
      className="flex flex-col gap-20"
      onSubmit={(event) => {
        event.preventDefault()
        const trimmed = note.trim()
        void repositories.workoutExercises.update(slot.id, {
          note: trimmed === '' ? null : trimmed,
        })
        onDone()
      }}
    >
      <div className="flex flex-col gap-8">
        <label htmlFor={id} className="text-label text-ink-3">
          {t('note')}
        </label>
        <textarea
          id={id}
          value={note}
          rows={3}
          maxLength={NOTE_MAX}
          placeholder={t('notePlaceholder')}
          onChange={(event) => {
            setNote(event.target.value)
          }}
          className="w-full resize-none rounded-ctl bg-sunk px-16 py-12 text-input text-ink placeholder:text-ink-3"
        />
        <p className="text-label text-ink-2">{t('noteHint')}</p>
      </div>
      <Pressable type="submit" className="rounded-ctl bg-ink py-12 text-body font-semibold text-bg">
        {t('saveNote')}
      </Pressable>
      <Pressable
        onClick={() => {
          onDone()
          void repositories.workoutExercises.remove(slot.id)
        }}
        className="self-start rounded-full bg-sunk px-16 py-12 text-label font-semibold text-ink-2"
      >
        {t('removeExercise')}
      </Pressable>
    </form>
  )
}
