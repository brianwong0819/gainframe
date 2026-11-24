import {
  type FoodEstimateRequest,
  type FoodEstimateResponse,
  foodEstimateResponseSchema,
} from '@gainframe/shared'

import type { ApiClient } from '../../api/client'

import { type EstimateProblem, problemOf } from './estimate-error'

export type PhotoEstimateResult =
  { kind: 'ready'; response: FoodEstimateResponse } | { kind: 'problem'; problem: EstimateProblem }

// One estimate of a shrunk photo (POST /api/food/estimate). A reply with no
// items is the problem the model gave for the photo. `api` is null in a build
// without sign-in.
export async function requestPhotoEstimate(
  api: ApiClient | null,
  photo: FoodEstimateRequest['photo'],
): Promise<PhotoEstimateResult> {
  if (api === null) return { kind: 'problem', problem: 'signIn' }
  try {
    const response = await api.request(foodEstimateResponseSchema, {
      method: 'POST',
      path: '/api/food/estimate',
      body: { photo },
    })
    if (response.items.length === 0) {
      return { kind: 'problem', problem: response.photoIssue ?? 'no_food' }
    }
    return { kind: 'ready', response }
  } catch (error) {
    return { kind: 'problem', problem: problemOf(error) }
  }
}
