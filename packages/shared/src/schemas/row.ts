import { z } from 'zod'

// A UTC instant as an ISO string with a `Z` offset, e.g. `2026-11-08T14:40:26.000Z`.
export const instantSchema = z.iso.datetime()

// The day a row counts for, in the user's time zone at write time. Produced only by
// `toLocalDate`; never derived from a UTC timestamp.
export const localDateSchema = z.iso.date().brand<'LocalDate'>()

export type LocalDate = z.infer<typeof localDateSchema>

// Fields every synced row carries (ADR-0003). `userId` is null on the device until
// the first sign-in, and the server always sets it from the verified JWT.
export const syncedRowSchema = z.object({
  id: z.uuidv7(),
  userId: z.string().min(1).nullable(),
  createdAt: instantSchema,
  updatedAt: instantSchema,
  deletedAt: instantSchema.nullable(),
})
