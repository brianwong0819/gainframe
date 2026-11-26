import { AnthropicBedrockMantle } from '@anthropic-ai/bedrock-sdk'
import Anthropic from '@anthropic-ai/sdk'
import { transformJSONSchema } from '@anthropic-ai/sdk/lib/transform-json-schema'

import type { AiContent, AiProvider, AiResponse } from './provider.ts'

type CreateParams = Parameters<Anthropic['messages']['create']>[0]
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

// Where Claude is called ("Providers" in docs/ai.md). Both take the same
// Messages request; only the client and its authentication differ.
// - `anthropic`: Anthropic's API, with an API key read from SSM.
// - `bedrock`: Amazon Bedrock's Messages API endpoint (`bedrock-mantle`),
//   signed with the Lambda role's credentials; model IDs carry the
//   `anthropic.` prefix.
// Tests pass client options with a fake `fetch` (and fixed keys).
export type ClaudeClient =
  | { provider: 'anthropic'; options: NonNullable<ConstructorParameters<typeof Anthropic>[0]> }
  | {
      provider: 'bedrock'
      options: NonNullable<ConstructorParameters<typeof AnthropicBedrockMantle>[0]>
    }

export function claudeProvider(client: ClaudeClient): AiProvider {
  // Retries are left to the SDK (2, for throttling and 5xx), inside the
  // caller's timeout; the pipeline's own retry is for invalid replies only.
  const { messages } =
    client.provider === 'anthropic'
      ? new Anthropic(client.options)
      : new AnthropicBedrockMantle(client.options)
  return {
    name: client.provider,
    generate: async (request) => {
      // The output format supports a subset of JSON Schema: the SDK's own
      // transform drops the dialect line and moves limits it cannot enforce,
      // such as `maximum` and `maxLength`, into descriptions. Zod still checks them.
      const schema = transformJSONSchema(request.jsonSchema)
      const message = await messages.create(
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

// The provider `aiConfig.provider` names. Without a key the Anthropic client
// still starts, and each call fails as `provider_error` (local runs without one).
export function configuredProvider(config: {
  provider: ClaudeClient['provider']
  region: string
  anthropicApiKey: string | undefined
}): AiProvider {
  return config.provider === 'anthropic'
    ? claudeProvider({ provider: 'anthropic', options: { apiKey: config.anthropicApiKey ?? null } })
    : claudeProvider({ provider: 'bedrock', options: { awsRegion: config.region } })
}
