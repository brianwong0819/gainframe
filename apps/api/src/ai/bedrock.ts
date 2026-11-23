import { AnthropicBedrockMantle } from '@anthropic-ai/bedrock-sdk'

import type { AiContent, AiProvider, AiResponse } from './provider.ts'

type CreateParams = Parameters<AnthropicBedrockMantle['messages']['create']>[0]
type Message = CreateParams['messages'][number]

function toBlocks(content: readonly AiContent[]): Exclude<Message['content'], string> {
  return content.map((block) =>
    block.type === 'text'
      ? { type: 'text', text: block.text }
      : {
          type: 'image',
          source: { type: 'base64', media_type: block.mediaType, data: block.data },
        },
  )
}

function stopReason(reason: string | null): AiResponse['stopReason'] {
  return reason === 'end_turn' || reason === 'max_tokens' || reason === 'refusal' ? reason : 'other'
}

// Claude on Amazon Bedrock through the Messages API (the `bedrock-mantle`
// endpoint), signed with the Lambda role's credentials. Model IDs carry the
// `anthropic.` prefix ("Bedrock model availability" in docs/ai.md).
// Tests pass the client options to sign with fixed keys and a fake `fetch`.
export function bedrockProvider(
  options: ConstructorParameters<typeof AnthropicBedrockMantle>[0],
): AiProvider {
  // Retries are left to the SDK (2, for throttling and 5xx), inside the
  // caller's timeout; the pipeline's own retry is for invalid replies only.
  const client = new AnthropicBedrockMantle(options)
  return {
    name: 'bedrock',
    generate: async (request) => {
      // The JSON Schema dialect line is not part of the output format.
      const schema = Object.fromEntries(
        Object.entries(request.jsonSchema).filter(([key]) => key !== '$schema'),
      )
      const message = await client.messages.create(
        {
          model: request.model,
          max_tokens: request.maxTokens,
          system: request.system,
          messages: request.messages.map((m) => ({ role: m.role, content: toBlocks(m.content) })),
          output_config: { effort: request.effort, format: { type: 'json_schema', schema } },
        },
        { signal: request.signal },
      )
      return {
        stopReason: stopReason(message.stop_reason),
        text: message.content
          .flatMap((block) => (block.type === 'text' ? [block.text] : []))
          .join(''),
        usage: {
          inputTokens: message.usage.input_tokens,
          outputTokens: message.usage.output_tokens,
          cacheReadTokens: message.usage.cache_read_input_tokens ?? 0,
          cacheWriteTokens: message.usage.cache_creation_input_tokens ?? 0,
        },
      }
    },
  }
}
