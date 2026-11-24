import type { ApiClient } from '../../api/client'
import { photosToEstimate, recordPhotoEstimate } from '../../db/pending-photos'
import type { GainframeDb, PendingPhoto } from '../../db/schema'

import type { EstimateProblem } from './estimate-error'
import { requestPhotoEstimate } from './photo-request'

type StopReason = NonNullable<PendingPhoto['stoppedBy']>

// Problems a later try would meet again: the model's verdict on the photo, a
// refusal, or an account without AI features. Any other problem (offline, the
// daily cap, a timeout, a failed answer) leaves the photo waiting.
const STOP_REASONS: ReadonlySet<EstimateProblem> = new Set<StopReason>([
  'no_food',
  'dark',
  'blurry',
  'cut_off',
  'refused',
  'notEnabled',
])
const stops = (problem: EstimateProblem): problem is StopReason => STOP_REASONS.has(problem)

/**
 * Estimates the photos kept while offline (M3-03), oldest first, one at a
 * time. Runs after a successful backup, which proves a connection and a
 * session. The first problem worth retrying ends the run; the photo is tried
 * again after the next backup. Returns how many photos got an estimate.
 */
export async function estimateKeptPhotos(db: GainframeDb, api: ApiClient | null): Promise<number> {
  let estimated = 0
  for (const row of await photosToEstimate(db)) {
    const result = await requestPhotoEstimate(api, row.photo)
    if (result.kind === 'ready') {
      await recordPhotoEstimate(db, row.id, { estimate: result.response, stoppedBy: null })
      estimated += 1
    } else if (stops(result.problem)) {
      await recordPhotoEstimate(db, row.id, { estimate: null, stoppedBy: result.problem })
    } else {
      return estimated
    }
  }
  return estimated
}
