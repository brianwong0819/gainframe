import type { ApiError } from '@gainframe/shared'

// The shared error shape; `requestId` matches the `x-request-id` header.
export function errorBody(
  code: ApiError['error']['code'],
  message: string,
  requestId: string,
): ApiError {
  return { error: { code, message, requestId } }
}
