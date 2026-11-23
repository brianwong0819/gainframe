# AI features

Three uses only: estimate food from a photo or a one-sentence description; write the weekly report and plateau analysis; answer fitness questions using the user's own data. **Rules find problems; AI explains them. The model looks; code counts.** No model training.

Plan reviewed 2026-11-22 (bw chose every recommendation): food estimates take their nutrients from the bundled food table, the OpenAI provider and bring-your-own key left the MVP, the topic guard is part of the coach prompt instead of a separate model, and numbers in generated text are filled in by code.

## Rules

- All provider calls go through `apps/api/src/ai`. Nothing else imports a provider SDK.
- One provider: Claude on Amazon Bedrock through Anthropic's TypeScript Bedrock SDK (`@anthropic-ai/bedrock-sdk`, the `AnthropicBedrockMantle` client, which exposes the Messages API). The `AiProvider` interface has two implementations, Bedrock and the fake used by unit tests and evals of the pipeline code. Another provider can be added behind the same interface after the MVP.
- Model IDs, effort, max tokens, timeouts and daily caps live in config (`apps/api/src/ai/config.ts`), never inline. No `temperature`, `top_p` or `top_k`: current models reject them. Look up current model IDs and Bedrock inference-profile IDs in the docs (context7 / AWS console); do not guess.
- Responses that code consumes use structured outputs (`output_config.format` with a JSON schema generated from the Zod schema in `packages/shared`), and are still validated with Zod. On validation failure: retry once with the error message, then fail cleanly. Do not force a tool call to get JSON (`tool_choice` `any` / `tool` is rejected by current models).
- Check `stop_reason` before reading content: `refusal` and `max_tokens` are outcomes, not crashes.
- Timeouts on every call. One `info` log line per call with `requestId`, feature, provider, model, prompt version, latency, tokens in/out (including cache reads and writes) and outcome (`ok`, `retried`, `invalid`, `refused`, `timeout`, `capped`, `provider_error`). On invalid output, log the Zod issue paths, not the output. Never log the image, prompts or model text.
- Bedrock model invocation logging stays off: it would store images and prompts. To debug a bad answer, use what the product already keeps (`meal_items.ai_raw`, `weekly_summaries`, `nudges.analysis`), each stored with model and prompt version.
- Daily caps are enforced server-side in `ai_usage` before the call is made: one statement counts the call only while the count is under the cap, per user, feature and UTC day. A failed call still counts. Entry point: `createAi` in `apps/api/src/ai/generate.ts`.
- The coach's tools are read-only and get `userId` from the server context; the model can never choose whose data to read.
- Health safety: injury, medication, eating-disorder or extreme-diet topics → suggest a professional. UI states "not medical advice".
- Photos are re-encoded on the device before upload (long edge ≤ 1600 px), which drops EXIF data such as location. The image sent to the model may be smaller still; its size is set in config and chosen with `pnpm eval:vision`.

## Models and cost

Each feature's model is chosen with its eval, comparing accuracy and cost per call; the eval report has a cost column. Rough cost per food photo at first-party list prices (check Bedrock pricing before relying on them): Claude Haiku 5.5 about $0.001, Claude Sonnet 5.5 about $0.02, Claude Opus 5.5 about $0.04. At four photos a day that is roughly $0.1, $2 or $4.5 a month against the $5 budget, so the cheapest model that holds the eval's accuracy wins. The weekly report and plateau analysis run once a week per user and can use a larger model.

- Effort: `low` for food estimates (latency matters, the task is short), the default for the coach, report and analysis. Set effort explicitly; defaults differ by model.
- Prompt caching: only where requests repeat within five minutes, which is the coach's tool loop (cache the system prompt and tool definitions). Meals are hours apart, so food estimates are not designed around caching.
- Bedrock has no server-side refusal fallback; a refusal is logged as `refused` and the user sees the manual entry path.
- Check whether the account's AWS promotional credits cover Anthropic models on Bedrock (Billing → Credits, applicable products) before assuming they pay for AI calls.

## Food estimates: the model looks, the table counts

The photo (M3-05) and text (M3-10) estimates return, per item: a food table entry id, or a name when nothing in the table fits; estimated grams; a confidence (`high`, `medium`, `low`); and alternative entries for the tap-to-correct list.

- Protein and energy come from the bundled Malaysian food table (per 100 g, with a default serving and a source column) and are computed in code from the grams. Only an item with no table entry carries model-estimated nutrients, and it is tagged as such on the confirm screen.
- The prompt carries the table's ids and names (not its nutrients), so the model picks an entry instead of inventing values.
- An item with `low` confidence shows a small / regular / large choice on the confirm screen; one tap sets the grams from the default serving.
- Oil and sauce stay a choice the user makes (`docs/design-system.md`, "Food logging"); the model cannot see them.
- The user's own and frequent foods are the most accurate path and stay one tap away.

## Bedrock model availability (ap-southeast-1)

Checked 2026-11-02 with `aws bedrock list-inference-profiles` in the workload account. Anthropic use-case details were submitted once (Bedrock console), which unlocks Anthropic models for the account.

- Current Claude models are available only as `global.` profiles, for example `global.anthropic.claude-haiku-5-5`, `global.anthropic.claude-sonnet-5-5`, `global.anthropic.claude-opus-5-5`.
- `apac.` profiles cover only Claude 3.x and 3.5 models; do not use them.
- Re-run the command before changing a model ID; the list changes as models launch and retire. Confirm which ID form the Mantle client expects in Anthropic's Bedrock documentation.

## Prompts

- Prompts are files: `apps/api/prompts/<feature>/v<N>.md`. Changing a prompt means adding a new version, not editing the old one in place.
- The active version per feature is set in config, and its number is stored with every result (`weekly_summaries.model`, `meal_items.ai_raw`, `nudges.model` / `nudges.prompt_version`).
- Generated text never states a number itself. The weekly report and plateau analysis return text with references to fields of the stats snapshot (for example `{protein_avg_g}`), and code fills in the values. An unknown reference fails validation.

## Evals (the AI part of the portfolio)

| Command | Data | Metric |
|---|---|---|
| `pnpm eval:vision` | 30–50 labelled food photos (private S3 / local, not in git) + labels JSON; from M3-10 also the same meals described in a sentence | per prompt version and model: mean absolute error and signed bias for protein g and kcal, share within ±20 %, cost per call; photo and text reported separately; baseline: table lookup at the default serving, no AI |
| `pnpm eval:summary` | fixed stats snapshots | every reference resolves to a snapshot field; no digits outside references |
| `pnpm eval:coach` | fixed user data + questions, including ≥ 50 in-scope and out-of-scope questions | correct tool chosen, cites real numbers, off-topic accuracy and false-refusal rate |

- Signed bias matters more than error size for a bulking user: an estimate that is too high makes them eat too little.
- Each case runs three times; the report shows the spread.
- A fixed test split (about a third of the cases) is never used while writing a prompt; the headline figure comes from it.
- Any PR that changes a prompt, model or AI schema must include the before/after eval output in its description. A regression needs bw's explicit OK.

## Learning from corrections (not training)

When the user corrects a food item and keeps "remember this correction" on, store the correction. On the next estimate, send the few most relevant past corrections as reference context. Corrections also become new eval cases.
