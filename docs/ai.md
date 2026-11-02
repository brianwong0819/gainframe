# AI features

Three uses only: estimate food from a photo; write the weekly report and plateau analysis; answer fitness questions using the user's own data. **Rules find problems; AI explains them.** No model training.

## Rules

- All provider calls go through `apps/api/src/ai`. Nothing else imports a provider SDK.
- One `AiProvider` interface with three implementations: Bedrock (default for bw + demo), Anthropic, OpenAI (bring-your-own key).
- Model IDs, max tokens, temperature and daily caps live in config (`apps/api/src/ai/config.ts`), never inline. Look up current model IDs and Bedrock inference-profile IDs in the docs (context7 / AWS console) — do not guess.
- Every response that code consumes is structured JSON validated with a Zod schema from `packages/shared`. On validation failure: retry once with the error message, then fail cleanly.
- Timeouts on every call. Log model, latency, tokens in/out and feature — never the image, the user's API key or full prompts with personal data.
- Daily caps are enforced server-side in `ai_usage` before the call is made.
- The coach's tools are read-only and get `userId` from the server context; the model can never choose whose data to read.
- Health safety: injury, medication, eating-disorder or extreme-diet topics → suggest a professional. UI states "not medical advice".

## Bedrock model availability (ap-southeast-1)

Checked 2026-11-02 with `aws bedrock list-inference-profiles` in the workload account. Anthropic use-case details were submitted once (Bedrock console), which unlocks Anthropic models for the account.

- Current Claude models are available only as `global.` profiles, for example `global.anthropic.claude-haiku-5-5`, `global.anthropic.claude-sonnet-5-5`, `global.anthropic.claude-opus-5-5`.
- `apac.` profiles cover only Claude 3.x and 3.5 models; do not use them.
- Candidates: Haiku for food-photo estimates, guardrail checks and tests; Sonnet for the weekly report and the coach. The choice per feature is made with its eval, not here.
- Re-run the command before changing a model ID; the list changes as models launch and retire.

## Prompts

- Prompts are files: `apps/api/prompts/<feature>/v<N>.md`. Changing a prompt means adding a new version, not editing the old one in place.
- The active version per feature is set in config, and its number is stored with every result (`weekly_summaries.model`, `meal_items.ai_raw`).

## Evals (the AI part of the portfolio)

| Command | Data | Metric |
|---|---|---|
| `pnpm eval:vision` | 30–50 labelled food photos (private S3 / local, not in git) + labels JSON | mean absolute error for protein g and kcal, per prompt version |
| `pnpm eval:guard` | ≥ 50 in-scope and out-of-scope questions | accuracy, false-refusal rate |
| `pnpm eval:summary` | fixed stats snapshots | every number in the text matches the snapshot (rule assertions) |
| `pnpm eval:coach` | fixed user data + questions | correct tool chosen, refusals correct, cites real numbers |

Any PR that changes a prompt, model or AI schema must include the before/after eval output in its description. A regression needs bw's explicit OK.

## Learning from corrections (not training)

When the user corrects a food item and keeps "remember this correction" on, store the correction. On the next estimate, send the few most relevant past corrections as reference context. Corrections also become new eval cases.
