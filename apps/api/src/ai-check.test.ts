import { describe, expect, it } from 'vitest'

import { AI_CHECK_USER, checkAi, isAiCheckEvent } from './ai-check.ts'
import { fakeProvider, type FakeStep, reply } from './ai/fake.ts'
import { createAi } from './ai/generate.ts'
import { createLogger } from './log.ts'

function check(steps: FakeStep[]) {
  const users: string[] = []
  const generate = createAi({
    provider: fakeProvider(steps),
    usage: {
      reserve: (key) => {
        users.push(key.userId)
        return Promise.resolve(true)
      },
      addTokens: () => Promise.resolve(),
    },
  })
  const log = createLogger({ release: 'test', write: () => undefined })
  return { result: checkAi(generate, log), users }
}

describe('isAiCheckEvent', () => {
  it('accepts only the exact direct-invocation event', () => {
    expect(isAiCheckEvent({ check: 'ai' })).toBe(true)
    expect(isAiCheckEvent({ check: 'ai', rawPath: '/api/health' })).toBe(false)
    expect(isAiCheckEvent({ check: 'database' })).toBe(false)
  })
})

describe('checkAi', () => {
  it('reports ok for the right answer, counted under the check user', async () => {
    const { result, users } = check([reply('{"answer":5}')])
    await expect(result).resolves.toEqual({ ai: 'ok' })
    expect(users).toEqual([AI_CHECK_USER])
  })

  it('reports a wrong answer and a failed call', async () => {
    await expect(check([reply('{"answer":4}')]).result).resolves.toEqual({ ai: 'wrong_answer' })
    await expect(check([reply('', 'refusal')]).result).resolves.toEqual({ ai: 'refused' })
  })
})
