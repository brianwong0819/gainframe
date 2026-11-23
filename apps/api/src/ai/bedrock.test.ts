import { describe, expect, it } from 'vitest'
import { z } from 'zod'

import { bedrockProvider } from './bedrock.ts'

// Signs with fixed keys and answers from a fake `fetch`, so the test shows the
// request the provider sends and how it reads the reply, without AWS.
function provider(reply: object) {
  const requests: { url: string; body: unknown; headers: Headers }[] = []
  const fetch = (input: string | URL | Request, init?: RequestInit) => {
    const body = init?.body
    requests.push({
      url: input instanceof Request ? input.url : input.toString(),
      body: typeof body === 'string' ? JSON.parse(body) : null,
      headers: new Headers(init?.headers),
    })
    return Promise.resolve(
      new Response(JSON.stringify(reply), { headers: { 'content-type': 'application/json' } }),
    )
  }
  const bedrock = bedrockProvider({
    awsRegion: 'ap-southeast-1',
    awsAccessKey: 'AKIDEXAMPLE',
    awsSecretAccessKey: 'secret',
    fetch,
    maxRetries: 0,
  })
  return { bedrock, requests }
}

const message = (stop_reason: string, text: string) => ({
  id: 'msg_1',
  type: 'message',
  role: 'assistant',
  model: 'anthropic.claude-haiku-5-5',
  stop_reason,
  stop_sequence: null,
  content: [{ type: 'text', text }],
  usage: {
    input_tokens: 120,
    output_tokens: 15,
    cache_read_input_tokens: null,
    cache_creation_input_tokens: 4,
  },
})

describe('bedrockProvider', () => {
  it('sends a signed Messages request with effort and the JSON schema as the output format', async () => {
    const { bedrock, requests } = provider(message('end_turn', '{"answer":5}'))
    const response = await bedrock.generate({
      model: 'anthropic.claude-haiku-5-5',
      effort: 'low',
      maxTokens: 256,
      system: 'Answer.',
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: 'What is 2 + 3?' },
            { type: 'image', mediaType: 'image/jpeg', data: 'AAAA' },
          ],
        },
      ],
      jsonSchema: z.toJSONSchema(z.object({ answer: z.int() })),
      signal: new AbortController().signal,
    })
    expect(requests[0]?.url).toBe(
      'https://bedrock-mantle.ap-southeast-1.api.aws/anthropic/v1/messages',
    )
    expect(requests[0]?.headers.get('authorization')).toMatch(/^AWS4-HMAC-SHA256 /)
    expect(requests[0]?.body).toMatchObject({
      model: 'anthropic.claude-haiku-5-5',
      max_tokens: 256,
      system: 'Answer.',
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: 'What is 2 + 3?' },
            { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: 'AAAA' } },
          ],
        },
      ],
      output_config: {
        effort: 'low',
        format: { type: 'json_schema', schema: { type: 'object', required: ['answer'] } },
      },
    })
    expect(JSON.stringify(requests[0]?.body)).not.toContain('$schema')
    // Limits the output format cannot enforce leave the schema; Zod checks them.
    const answer = z
      .object({
        output_config: z.object({
          format: z.object({
            schema: z.object({
              properties: z.object({ answer: z.record(z.string(), z.unknown()) }),
            }),
          }),
        }),
      })
      .parse(requests[0]?.body).output_config.format.schema.properties.answer
    expect(answer).toMatchObject({ type: 'integer' })
    expect(answer).not.toHaveProperty('maximum')
    expect(answer).not.toHaveProperty('minimum')
    expect(JSON.stringify(requests[0]?.body)).not.toMatch(/temperature|top_p|top_k/)
    expect(response).toEqual({
      stopReason: 'end_turn',
      text: '{"answer":5}',
      usage: { inputTokens: 120, outputTokens: 15, cacheReadTokens: 0, cacheWriteTokens: 4 },
    })
  })

  it('reads a refusal and an unexpected stop reason', async () => {
    const request = {
      model: 'anthropic.claude-haiku-5-5',
      effort: 'low' as const,
      maxTokens: 256,
      system: 'Answer.',
      messages: [],
      jsonSchema: { type: 'object' },
      signal: new AbortController().signal,
    }
    const refused = await provider(message('refusal', '')).bedrock.generate(request)
    expect(refused.stopReason).toBe('refusal')
    const other = await provider(message('tool_use', '')).bedrock.generate(request)
    expect(other.stopReason).toBe('other')
  })
})
