import { type LocalDate, type MealType, toLocalDate } from '@gainframe/shared'

import { newId } from './id'
import type { GainframeDb, PendingPhoto } from './schema'

/**
 * Keeps a photo taken while offline for a later estimate (M3-03). The day it
 * counts for is computed in `timeZone` at `takenAt`, as for a logged meal.
 */
export async function keepPhoto(
  db: GainframeDb,
  values: {
    takenAt: string
    timeZone: string
    mealType: MealType
    photo: PendingPhoto['photo']
  },
): Promise<PendingPhoto> {
  const row: PendingPhoto = {
    id: newId(Date.now()),
    takenAt: values.takenAt,
    localDate: toLocalDate(values.takenAt, values.timeZone),
    mealType: values.mealType,
    photo: values.photo,
    estimate: null,
    stoppedBy: null,
  }
  await db.pendingPhotos.add(row)
  return row
}

/** A day's kept photos, newest first. */
export async function pendingPhotosOn(db: GainframeDb, date: LocalDate): Promise<PendingPhoto[]> {
  const rows = await db.pendingPhotos.where('localDate').equals(date).toArray()
  return rows.toSorted((a, b) => b.takenAt.localeCompare(a.takenAt))
}

/** Kept photos with no estimate yet whose estimate is still worth trying, oldest first. */
export async function photosToEstimate(db: GainframeDb): Promise<PendingPhoto[]> {
  const rows = await db.pendingPhotos
    .filter((row) => row.estimate === null && row.stoppedBy === null)
    .toArray()
  return rows.toSorted((a, b) => a.takenAt.localeCompare(b.takenAt))
}

/** Stores a kept photo's estimate or why it stopped; a discarded photo stays gone. */
export async function recordPhotoEstimate(
  db: GainframeDb,
  id: string,
  result: Pick<PendingPhoto, 'estimate' | 'stoppedBy'>,
): Promise<void> {
  await db.pendingPhotos.update(id, result)
}

export async function discardPhoto(db: GainframeDb, id: string): Promise<void> {
  await db.pendingPhotos.delete(id)
}
