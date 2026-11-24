import { type ApiError, type PhotoIssue } from '@gainframe/shared'

import { ApiRequestError, NotSignedInError } from '../../api/client'

// Why there is no estimate to confirm. The photo issues come from the model;
// the rest from the request ("States" in docs/design-system.md). `no_text_food`
// is a description that names no food.
export type EstimateProblem =
  | 'signIn'
  | 'notEnabled'
  | 'offline'
  | 'unavailable'
  | 'timeout'
  | 'failed'
  | 'refused'
  | 'capped'
  | 'no_text_food'
  | PhotoIssue

// The API's AI error codes as problems; any other answer is a failed estimate.
const API_PROBLEMS: Partial<Record<ApiError['error']['code'], EstimateProblem>> = {
  ai_not_enabled: 'notEnabled',
  ai_capped: 'capped',
  ai_unavailable: 'unavailable',
  ai_timeout: 'timeout',
  ai_refused: 'refused',
}

export function problemOf(error: unknown): EstimateProblem {
  if (error instanceof NotSignedInError) return 'signIn'
  if (error instanceof ApiRequestError) {
    return (error.code === null ? undefined : API_PROBLEMS[error.code]) ?? 'failed'
  }
  return navigator.onLine ? 'failed' : 'offline'
}
