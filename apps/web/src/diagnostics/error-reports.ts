// Sends the errors recorded on a signed-in device to POST /api/client-errors
// (M2-08), so a crash on the phone shows up in the API's logs and alarm without
// the user copying a report. Entries go in `seq` order, at most
// CLIENT_ERROR_REPORT_MAX at a time, and the last one sent is remembered.
import {
  CLIENT_ERROR_REPORT_MAX,
  clientErrorReportResponseSchema,
  clientErrorSchema,
} from '@gainframe/shared'

import { type ApiClient, ApiRequestError } from '../api/client'
import type { GainframeDb } from '../db/schema'

const KEY = 'errorsReportedSeq'

async function reportedSeq(db: GainframeDb): Promise<number> {
  const setting = await db.settings.get(KEY)
  const seq = Number(setting?.value ?? 0)
  return Number.isSafeInteger(seq) ? seq : 0
}

// Returns how many errors were sent. A batch the API refuses (4xx other than
// 401, which means the sign-in failed rather than the report) counts as
// sent: sending it again would fail again, and each failure is itself recorded,
// so retrying would grow the log on every backup. Other failures throw, and the
// batch goes with the next call.
export async function sendErrorReports(db: GainframeDb, api: ApiClient): Promise<number> {
  let sent = 0
  for (;;) {
    const after = await reportedSeq(db)
    const batch = await db.errors.where('seq').above(after).limit(CLIENT_ERROR_REPORT_MAX).toArray()
    const last = batch.at(-1)
    if (last === undefined) return sent
    // An entry recorded under an older schema is skipped rather than sent.
    const errors = batch.flatMap((entry) => {
      const parsed = clientErrorSchema.safeParse(entry)
      return parsed.success ? [parsed.data] : []
    })
    try {
      if (errors.length > 0) {
        await api.request(clientErrorReportResponseSchema, {
          method: 'POST',
          path: '/api/client-errors',
          body: { errors },
        })
      }
    } catch (error) {
      const refused =
        error instanceof ApiRequestError &&
        error.status >= 400 &&
        error.status < 500 &&
        error.status !== 401
      if (!refused) throw error
    }
    await db.settings.put({ key: KEY, value: String(last.seq) })
    sent += errors.length
  }
}
