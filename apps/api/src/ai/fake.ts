import type { AiProvider, AiRequest, AiResponse } from './provider.ts'

// The provider used by unit tests: each call takes the next scripted step and
// records the request. A step that waits for the abort stands in for a timeout.
export type FakeStep = AiResponse | { throws: Error } | 'hang'

export function fakeProvider(steps: readonly FakeStep[]): AiProvider & { requests: AiRequest[] } {
  const queue = [...steps]
  const requests: AiRequest[] = []
  return {
    name: 'fake',
    requests,
    generate: (request) => {
      requests.push(request)
      const step = queue.shift()
      if (step === undefined) return Promise.reject(new Error('fake provider: no step left'))
      if (step === 'hang') {
        return new Promise((_, reject) => {
          request.signal.addEventListener('abort', () => {
            reject(new Error('aborted'))
          })
        })
      }
      if ('throws' in step) return Promise.reject(step.throws)
      return Promise.resolve(step)
    },
  }
}

export function reply(text: string, stopReason: AiResponse['stopReason'] = 'end_turn'): AiResponse {
  return {
    stopReason,
    text,
    usage: { inputTokens: 100, outputTokens: 20, cacheReadTokens: 0, cacheWriteTokens: 0 },
  }
}
