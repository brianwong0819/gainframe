'use client'

import { linkedWithNext, moveItem, type WorkoutExercise } from '@gainframe/shared'
import { useTranslations } from 'next-intl'
import { useId, useState } from 'react'

import { repositories, workoutSession } from '@/db/client'
import { OrderActions } from '@/ui/order-actions'
import { Pressable } from '@/ui/pressable'

const NOTE_MAX = 500

// Everything about one exercise in this workout besides its sets: moving it up
// or down (when a machine is taken), joining it with the next exercise into a
// superset or splitting them, its note for this workout, and removing it.
export function SlotActions({
  slot,
  slots,
  nameOf,
  onDone,
  onLinked,
}: {
  slot: WorkoutExercise
  // The workout's live slots in order.
  slots: readonly WorkoutExercise[]
  nameOf: (exerciseId: string) => string
  onDone: () => void
  // Joining opens the new superset's rest.
  onLinked: () => void
}) {
  const t = useTranslations('workout')
  const id = useId()
  const [note, setNote] = useState(slot.note ?? '')
  const next = slots[slots.findIndex(({ id: other }) => other === slot.id) + 1]
  const linked = linkedWithNext(slots, slot.id)

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
      <OrderActions
        labels={{ up: t('moveUp'), down: t('moveDown') }}
        canMove={(direction) => moveItem(slots, slot.id, direction).length > 0}
        onMove={(direction) => {
          void workoutSession.moveSlot(slot.id, direction)
        }}
        link={
          next === undefined
            ? null
            : {
                linked,
                label: t(linked ? 'supersetSplit' : 'supersetWith', {
                  name: nameOf(next.exerciseId),
                }),
                onToggle: () => {
                  void workoutSession.linkWithNext(slot.id, !linked).then(() => {
                    if (!linked) onLinked()
                  })
                },
              }
        }
      />
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
