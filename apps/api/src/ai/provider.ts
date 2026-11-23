// The one interface every model provider implements: Bedrock in production,
// the fake in tests (docs/ai.md). Only `apps/api/src/ai` imports a provider SDK.

export type AiContent =
  | { type: 'text'; text: string }
  // Base64 data of an image re-encoded on the device (M3-03).
  | { type: 'image'; mediaType: 'image/jpeg' | 'image/png' | 'image/webp'; data: string }

export type AiMessage =
  | { role: 'user'; content: readonly AiContent[] }
  | { role: 'assistant'; content: readonly AiContent[] }

export interface AiRequest {
  model: string
  effort: 'low' | 'medium' | 'high'
  maxTokens: number
  system: string
  messages: readonly AiMessage[]
  // The JSON schema the reply must follow (structured outputs).
  jsonSchema: Record<string, unknown>
  signal: AbortSignal
}

export interface AiUsage {
  inputTokens: number
  outputTokens: number
  cacheReadTokens: number
  cacheWriteTokens: number
}

export interface AiResponse {
  // `other` covers stop reasons a structured reply never expects, e.g. `tool_use`.
  stopReason: 'end_turn' | 'max_tokens' | 'refusal' | 'other'
  // The reply's text blocks joined.
  text: string
  usage: AiUsage
}

export interface AiProvider {
  name: string
  // Rejects when the request fails or `signal` aborts it.
  generate: (request: AiRequest) => Promise<AiResponse>
}
