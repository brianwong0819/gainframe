# ADR-0008: Call Claude through Anthropic's API while Bedrock lacks Haiku 5.5

- Status: accepted
- Date: 2026-11-25

## Context

The AI layer (M3-04) calls Claude Haiku 5.5 through Amazon Bedrock's Messages API endpoint (`bedrock-mantle`). The workload account cannot use it: Bedrock answers "not available for this account" for Claude Haiku 5.5 and Claude Sonnet 5.5, and an AWS Support case opened on 2026-11-24 has had no answer. The photo and one-sentence food estimates (M3-05, M3-06, M3-10) are built but cannot run. The owner's constraints: spend as little as possible, but ship something that works; AI stays server-side and limited to the Cognito group `ai`.

## Options considered

1. **Anthropic's API (Claude Haiku 5.5).** Same Messages API, request shape, structured outputs and model the prompts were written for; the client is `Anthropic` from `@anthropic-ai/sdk`, already a dependency. Prepaid credit, about USD 0.004 per photo with the food table in the prompt. Needs an Anthropic Console account and an API key in SSM. Not covered by AWS credits.
2. **Amazon Nova 2 Lite on Bedrock (`bedrock-runtime`).** Probably payable from the account's AWS promotional credit, no new account. Its model card lists structured outputs as not supported, it needs a second client (`@aws-sdk/client-bedrock-runtime`) and the Converse API, and its accuracy on Malaysian food is untested.
3. **Gemini API free tier.** No cost, but free-tier prompts and images may be used for training and human review, the daily limits are small and unpublished, and calls from Singapore cloud addresses have been reported as refused. New SDK and schema dialect.
4. **Keep waiting for Bedrock.** No change; the AI features stay unusable for an unknown time.

## Decision

Option 1. `aiConfig.provider` selects `anthropic` or `bedrock`; both run through one `claudeProvider` (`apps/api/src/ai/claude.ts`) because the two endpoints take the same request. Bedrock stays as the other value, so moving back once AWS enables the model is a config change (the provider and the `anthropic.`-prefixed model IDs).

## Consequences

- One more external service and secret: `/gainframe/<env>/anthropic-api-key` (SecureString, placeholder written by Terraform, value set by the owner), read at cold start like the database URL. No CSP change: the call is server-side.
- Spend is bounded twice: the per-user daily caps in `ai_usage`, and the prepaid credit balance with auto-reload off, so a bug cannot run up a bill. AWS Budgets do not see this spend; the Anthropic Console's usage page does.
- Photos and descriptions go to Anthropic instead of AWS. Under Anthropic's commercial terms API inputs are not used for training. Nothing is stored on our side beyond what the product already keeps.
- `pnpm eval:vision` (M3-08) reports the provider with the model, so results from the two endpoints are not mixed.
