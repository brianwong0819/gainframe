import { type LocalDate, localDateSchema } from '../schemas/row.ts'

// The only way code turns an instant into the day it counts for. `timeZone` is an
// IANA name such as `Asia/Kuala_Lumpur`; an unknown name throws a RangeError.
export function toLocalDate(instant: string, timeZone: string): LocalDate {
  const time = Date.parse(instant)
  if (Number.isNaN(time)) {
    throw new RangeError(`Invalid instant: ${instant}`)
  }
  // en-CA formats dates as YYYY-MM-DD; the parts are read explicitly anyway.
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(time)
  const part = (type: 'year' | 'month' | 'day') => parts.find((p) => p.type === type)?.value
  return localDateSchema.parse(`${part('year') ?? ''}-${part('month') ?? ''}-${part('day') ?? ''}`)
}
