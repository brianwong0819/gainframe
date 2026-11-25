# Lessons

The project's memory of mistakes. Read "Active rules" before every task. Add an entry in the same PR whenever something goes wrong (see "Learning loop" in `CLAUDE.md`).

## Active rules

Rules from recent lessons that have not yet moved into `CLAUDE.md`, a `docs/*` file or an automated check. Each links to the lesson that created it. At each milestone retro, rules that have proved themselves move into the matching doc (and leave this list); rules that turned out wrong are deleted.

- A value one app writes and the other parses (header format, query parameter, body shape) is defined once in `packages/shared` with a round-trip test; tests on either side import it rather than writing the literal. ([L-042](#l-042--2026-11-22--sync--every-push-was-refused-with-401-the-client-sent-the-token-without-bearer-))
- Run gitleaks on a branch's commits before its first push; the CI scan covers history, so a later commit cannot clear a finding. ([L-050](#l-050--2026-11-25--ci--a-code-comment-naming-a-model-id-tripped-the-secret-scan))
- Write deny patterns for secret files with `**/` so they cover every workspace, and re-check them when a task adds a new secret file. ([L-006](#l-006--2026-11-02--tooling--claude-code-could-read-appsapienv))

Promoted at the M1 retro (2026-11-16), so read them where they now live:

| Area | Lessons | Now in |
|---|---|---|
| WebKit and the iPhone: a UI change is done only when CI's WebKit devices are green | L-015, L-016, L-019, L-020, L-023, L-027, L-028, L-029, L-033 | `CLAUDE.md` work loop step 5 |
| e2e tests: wait for stored values, `fill`, sheets, touch swipes, offline by stopping the server, `--repeat-each` | L-024, L-027, L-029, L-033 | "Tests" in `docs/conventions.md` |
| Prerendered buttons that write wait for their data; `useLiveQuery` reads Dexie directly | L-026, L-028 | "React" in `docs/conventions.md` |
| Sheets, back links, Reduce Motion, focus ring, safe areas | L-015, L-018 to L-021, L-023, L-025 | `docs/design-system.md` (Navigation, Sheets, Motion, Screen edges; L-020, L-025 lint- and test-guarded) |
| Measure a visual glitch before fixing it | L-023 | "When things go wrong" in `CLAUDE.md` |
| Read current vendor and platform docs before planning | L-004, L-016 | `CLAUDE.md`, after the context7 rule |
| Steps written for bw (PowerShell, `cd`, prerequisites, masking, home-screen app) | L-001, L-005, L-010, L-011, L-017 | "Environment notes" in `CLAUDE.md` |
| Workflow scripts, AWS CLI output, verifying IAM from the real caller, public logs | L-012, L-013, L-014 | "Workflows" in `docs/infra.md` |
| `pnpm check` last before each commit; verify with the command that proves it | L-002, L-031 | `CLAUDE.md` work loop step 5 |
| Look ahead and mid-milestone review; branch names | L-008, L-009 | `CLAUDE.md` work loop, "Git" in `docs/conventions.md` |
| Actions minutes | L-030 | "Cost watch" in `docs/infra.md` (the repository is public, so the USD 12 cap no longer applies) |
| Deploy only the latest `main` commit | L-022 | guarded in `deploy.yml` |

## How to write a lesson

Copy this block to the top of the log. Keep it short; the point is the rule change.

```md
### L-000 · YYYY-MM-DD · <area tag> · <one-line title>
- **What happened:** the symptom, and how it was noticed (bw / CI / review / prod).
- **Root cause:** why it happened — the actual reason, not "a typo". Was a rule missing, unclear, or ignored?
- **Fix:** PR or commit.
- **Prevention:** what changed so it cannot recur — prefer a lint rule, test, type, CI check or hook; else a doc rule (name the file).
- **Status:** guarded (automated check) | documented (prose rule) | open
```

Area tags: `workout`, `food`, `sync`, `auth`, `ai`, `infra`, `ci`, `ui`, `motion`, `i18n`, `pwa`, `tooling`, `process`.

## Log

_Newest first._

### L-050 · 2026-11-25 · ci · A code comment naming a model ID tripped the secret scan
- **What happened:** the first push of the Anthropic provider failed CI's Secret scan: gitleaks' `generic-api-key` rule matched a comment in `apps/api/src/ai/config.ts` that put the word "API" next to a model ID in backticks. The scan covers the branch's whole history, so a follow-up commit could not clear it; the work moved to a fresh branch with one commit (no force-push).
- **Root cause:** the scan ran only in CI; nothing ran it locally before the first push.
- **Fix:** PR `m3/04-anthropic-api` (comment reworded).
- **Prevention:** before the first push of a branch, run gitleaks on the branch (`gitleaks git . --config .gitleaks.toml --log-opts="origin/main..HEAD"`; version and checksum in `.github/workflows/ci.yml`). Added under "Active rules".
- **Status:** documented

### L-049 · 2026-11-24 · ci · Dev stopped deploying because main's device job hit its timeout
- **What happened:** after #189, CI on `main` was cancelled for #190, #191 and #192, so `deploy.yml` skipped each of them and dev stayed on #189's build for over an hour. Nobody noticed until a Terraform plan showed the Lambda's `RELEASE` was still #189's commit.
- **Root cause:** the Device layout job had a 15-minute timeout. On `main` it runs six devices, about 8 minutes for 630 tests, and the `playwright install --with-deps` step took 10.5 minutes on 2026-11-23 instead of about 1. Pull requests run two devices, so they stayed green.
- **Fix:** PR `m3/ci-device-timeout` raises the timeout to 25 minutes.
- **Prevention:** after merging, check that the `main` CI run and its deploy finished, not only the pull request's checks. Raise the device job's timeout when the suite grows past half of it.
- **Status:** documented

### L-048 · 2026-11-23 · sync · The version 13 Dexie upgrade broke as soon as a synced table was added
- **What happened:** adding the `foods` table (Dexie version 14) made the version 12 → 13 upgrade test fail with "Table foods not part of transaction". A device still on version 12 would have failed to open the app.
- **Root cause:** `adoptBackedUpRows` (version 13) iterated `syncedTableNameSchema.options`, the current list of synced tables, which grows with each new table. An upgrade step only holds the tables of its own version.
- **Fix:** PR `m3/12-food-library`: the upgrade names its version's tables in a constant.
- **Prevention:** "Tests" in `docs/conventions.md`: an upgrade function names its own tables. The upgrade tests open every earlier version at the current one, which is what caught it.
- **Status:** guarded (upgrade tests)
### L-047 · 2026-11-23 · ai · The Bedrock provider sent JSON Schema limits the output format rejects
- **What happened:** writing M3-05, the photo estimate's schema came out of `z.toJSONSchema` with `minimum`, `maximum`, `maxLength` and `maxItems`. The M3-04 provider passed the schema on with only `$schema` removed, so the first real call with it would have been refused; the deploy's AI check (`z.int()`, which also yields `minimum` and `maximum`) had not reached that point because the model returned 404.
- **Root cause:** the provider was written from the shape of `output_config.format` without the list of JSON Schema features structured outputs supports; the SDK applies its own transform only in its Zod and JSON-schema helpers, which the provider does not use.
- **Fix:** PR `m3/05-vision-estimate`: the provider passes every schema through the SDK's `transformJSONSchema`; Zod still checks the limits.
- **Prevention:** a provider test asserts that `minimum` and `maximum` leave the schema sent to the model; "Rules" in `docs/ai.md` names the transform.
- **Status:** guarded

### L-046 · 2026-11-23 · food · A meal item's gram stepper showed "399" with no unit
- **What happened:** bw opened a meal and asked what the 399 under 椰浆饭 meant. It was the portion in grams, but the stepper showed the bare number.
- **Root cause:** `Stepper` was built for the workout panel, where the label beside it names the unit (kg, reps). The meal item reused it without that label, and nothing in the component asked for a unit.
- **Fix:** PR `m3/02-grams-unit` adds an optional `unit` to `Stepper`, shown small after the number, and the meal item passes "g".
- **Prevention:** design principle 5 ("units on every number") applies to steppers: a stepper with no label naming its unit passes `unit`.
- **Status:** documented

### L-045 · 2026-11-23 · ui · The tab bar and dock floated over the search results while the iPhone keyboard was open
- **What happened:** bw searched the food table on the manual screen on the iPhone. With the keyboard open, the dock and the tab bar stood above it with the tab bar's empty home-indicator inset below them, and the results had about half the space left.
- **Root cause:** the manual screen was the first tab screen with a search field on the page itself (the exercise searches are in sheets, which follow the visual viewport since #121). The tab bar and dock were designed only for the keyboard-closed state, and the cloud's Chromium shows no on-screen keyboard, so no test saw it.
- **Fix:** PR `m3/11-keyboard-dock` hides the tab bar while a text field has focus and moves `.screen-dock` down to the keyboard; `e2e/food.spec.ts` checks the tab bar hides while searching.
- **Prevention:** "Navigation" in `docs/design-system.md` states the keyboard-open state of the tab bar and dock; a new screen with a text field is designed for the keyboard-open state too.
- **Status:** documented

### L-044 · 2026-11-23 · git · Conflict markers in ROADMAP and STATUS were committed and pushed
- **What happened:** merging `main` into `m4/01-target-calculator` after #157 was squash-merged conflicted in three files. Only the code file was resolved; `git add -A` then committed `docs/ROADMAP.md` and `docs/STATUS.md` with their conflict markers, and the branch was pushed before the PR was opened.
- **Root cause:** the merge output was cut to its last lines, so two of the three conflicts went unseen, and `pnpm check` does not read Markdown, so nothing failed.
- **Fix:** the next commit on the same branch resolves both files (only this branch's own edits differed).
- **Prevention:** "Git" in `docs/conventions.md`: run `git diff --check origin/main` after resolving a merge and before staging, and never stage an unfinished merge with `git add -A`.
- **Status:** documented

### L-043 · 2026-11-22 · ui · "新建食物" did nothing when tapped right after the manual screen opened
- **What happened:** on #154 the Device layout job failed on iPhone SE: the test opened `/food/add` and tapped "新建食物" at once, and the sheet never opened.
- **Root cause:** a repeat of L-028. The manual screen's dock was prerendered and tappable before hydration, although `docs/conventions.md` already says a writing button renders only once its data has loaded. The rule was prose and the new screen had no delayed-chunk test. Reproduced in Chromium with the chunks delayed by 400 ms.
- **Fix:** PR `m3/02-frequent-foods` renders the dock only once the foods have loaded, and adds the delayed-chunk test for it.
- **Prevention:** `docs/conventions.md` now requires the delayed-chunk e2e test for every new screen whose first control writes, not only the render rule.
- **Status:** documented

### L-042 · 2026-11-22 · sync · Every push was refused with 401: the client sent the token without "Bearer "
- **What happened:** after M2-05 shipped, backup on bw's iPhone never succeeded: 94 changes stayed pending and Diagnostics showed `POST /api/sync/push answered 401` on every run, including the retry after a token refresh.
- **Root cause:** the API's auth middleware (M2-02) reads `x-gainframe-token` as `Bearer <token>`, and its tests sent that format; the web API client (M2-05) sent the bare token, and its tests asserted the bare token. Each side was tested only against its own idea of the format, and nothing exercised the two together before the iPhone did.
- **Fix:** PR `m2/05-sync-diagnostics`: the header name, its formatter and its parser live in `packages/shared/src/token-header.ts`, and both apps use them. The sync engine also records a failure that has no API status (a response that fails its schema, a storage error) in Diagnostics, which before left no trace.
- **Prevention:** rule in "Active rules": a value one app writes and the other parses (a header format, a query parameter, a body shape) is defined once in `packages/shared`, with the formatter and the parser tested against each other; tests on either side import it instead of writing the literal.
- **Status:** guarded (shared module and its round-trip test)

### L-041 · 2026-11-22 · pwa · Every offline navigation reloaded the whole page
- **What happened:** `e2e/offline.spec.ts` failed on `main` after #145 on iPhone 17e (WebKit), blocking a deploy, and once before on iPhone SE (2026-11-17): after finishing offline, tapping 完成 on the summary left the page at `/workout/summary`. Re-runs passed.
- **Root cause:** a client-side navigation fetches the next page's RSC payload as `summary.txt?_rsc=<hash>`. The service worker precaches `summary.txt` without parameters and Serwist ignores only `utm_*` and `fbclid` when matching, so offline every payload request missed the precache, failed, and Next fell back to loading the whole document. Measured in Chromium by logging requests: after going offline each tap produced a failed `.txt?_rsc=` fetch followed by a `document` request, and the test tapped 完成 7 ms before the reloaded summary's `load` event, before hydration. That tap was lost now and then in WebKit, as in L-028. Users were affected too: at the gym every tab switch was a full page load, which also dropped in-memory state such as the summary's celebration.
- **Fix:** PR `m1/offline-summary-flake`: `src/sw/sw.ts` ignores the `_rsc` parameter when matching the precache, so offline navigations stay client-side. The spec sets a marker on `window` once offline and asserts it survives to the history page; without the fix it fails on every run.
- **Prevention:** the marker assertion in `e2e/offline.spec.ts` (guarded). Rule in "Tests" in `docs/conventions.md`: an e2e flake gets measured (request and navigation log) before it is re-run away.
- **Status:** guarded

### L-040 · 2026-11-22 · test · Two integration test files migrated the database at the same time
- **What happened:** CI's Check and build failed on PR #140 with `duplicate key value violates unique constraint "pg_namespace_nspname_index"` from `CREATE SCHEMA IF NOT EXISTS "drizzle"`; the same tests had passed on #139 and locally.
- **Root cause:** `sync.int.test.ts` (#139) ran the migrations in `beforeAll` while `migrate.int.test.ts` ran them in another worker. `IF NOT EXISTS` does not make two concurrent `CREATE SCHEMA` statements safe; whichever commits second fails. Whether they overlap depends on timing, so it passed twice before failing.
- **Fix:** the integration project's `globalSetup` (`apps/api/src/db/integration-setup.ts`) migrates once before any file runs; test files no longer migrate.
- **Prevention:** rule in "Tests" in `docs/conventions.md`: integration test files share one database and never change its schema; only the global setup and `migrate.int.test.ts` migrate.
- **Status:** documented

### L-039 · 2026-11-22 · infra · A Terraform plan comment showed the Cognito client ID
- **What happened:** the dev plan posted on PR #140 listed the Cognito web client in full, its ID included, in a public comment and in the job log. The comment was edited by hand.
- **Root cause:** `plan.yml` replaced only the account ID. Terraform prints a resource's ID in every in-place update, and the auth module (M2-02) added resources whose IDs CLAUDE.md lists as never to appear in PRs or CI logs. Marking the outputs `sensitive` hides outputs, not resource attributes in a plan.
- **Fix:** `.github/scripts/mask-cognito-ids.sh` reads the pool and client IDs from the state outputs after `terraform init`, masks them for the rest of the job and lists them for the plan comment, which replaces them; `plan.yml` and `deploy.yml` run it before plan and apply.
- **Prevention:** the script runs in both workflows; a new resource whose ID is private gets an output and a line in that script in the same PR (this entry).
- **Status:** guarded

### L-038 · 2026-11-22 · workout · The first rest cue fix missed WebKit's silent audio context
- **What happened:** after L-037's fix bw still heard no cue at times while staying in the app, possibly only after having switched away earlier in the workout.
- **Root cause:** L-037 assumed that iOS returns the audio context to a working state on return and fixed only the delay. Open WebKit bugs ([263627](https://bugs.webkit.org/show_bug.cgi?id=263627), [276016](https://bugs.webkit.org/show_bug.cgi?id=276016)) report that a context can come back reporting `running` while it plays nothing, and it stays that way, so every later cue in the workout is silent. The bug tracker was not searched before the first fix, although the rule to read current platform behaviour first (L-004, L-016) covers it.
- **Fix:** `m1/rest-cue-fresh-context`: the context is suspended and resumed on each return (the workaround in those bugs), any tap in an open workout unlocks the audio, and the first tap after the page was hidden replaces the context with a new one.
- **Prevention:** `rest-cue.test.ts` covers the return, the replacement and the tap; "Read current vendor and platform docs" now names the vendor's bug tracker for platform defects (this entry).
- **Status:** guarded

### L-037 · 2026-11-21 · workout · The rest cue was sometimes silent on the iPhone
- **What happened:** during the field week bw found that the rest timer sometimes ended without a sound.
- **Root cause:** `playRestCue` played only when the audio context was `running` and otherwise returned silently. iOS interrupts the context while the app is hidden and resumes it about 50 ms after the app is shown again (ADR-0005's measurement), but the rest timer asks for the cue in the render that follows `visibilitychange`, before that. A rest that ended while bw was in another app therefore came back silent, and the return cue plays only once. Another app's sound interrupting the context on screen had the same effect. The ADR measured the resume delay; the code did not account for it.
- **Fix:** `m1/rest-cue-resume`: a cue asked for while the context is not running resumes it and plays when it runs again, unless that takes longer than a second.
- **Prevention:** `rest-cue.test.ts` covers the cue with an interrupted context that resumes late, too late and never.
- **Status:** guarded

### L-036 · 2026-11-17 · test · Adding built-in exercises broke two e2e tests
- **What happened:** on the first exercise library PR, CI's Device layout job failed twice: the picker test that creates a missing exercise named it 地雷管推举, which became a built-in exercise, so the library showed two matches; the keyboard test searched 哑铃飞鸟, which now also matched 上斜哑铃飞鸟, so its last result sat below the keyboard on iPhone SE.
- **Root cause:** both tests depended on the catalog's content (which names exist, how many match a query) without saying so. `pnpm check` cannot see e2e specs, and the PR was pushed before running them.
- **Fix:** the missing exercise is 地雷管划船, and the keyboard test searches 前平举, which matches two exercises again, the case its comment describes.
- **Prevention:** rule in "Tests" in `docs/conventions.md`: a spec that needs a missing exercise or a fixed number of search results says so in a comment, and a change to the built-in catalog runs the specs that search it (`grep -l searchbox e2e`) before pushing.
- **Status:** documented

### L-035 · 2026-11-17 · ui · The exercise picker's results were under the iPhone keyboard
- **What happened:** bw, on the iPhone: in the plan editor's "添加到「…」" sheet, a search that left two results shrank the sheet to the bottom of the screen, under the keyboard, so a result could be tapped only after closing the keyboard. The workout's picker shares the sheet and had the same defect.
- **Root cause:** the sheet was sized to the layout viewport (`position: fixed; inset: 0`). iOS Safari shows the keyboard over the page and shrinks only the visual viewport, so a panel anchored to the bottom sits under the keyboard. The sheet rules covered focus and scrolling on opening (L-019, L-020) but not the keyboard; Chromium in the container and Playwright's WebKit show no on-screen keyboard, so no test saw it.
- **Fix:** PR `m1/fix-sheet-keyboard`: `Sheet` sets `--sheet-top`, `--sheet-height` and `--sheet-below` from `window.visualViewport` while open, and the picker sheets keep their full height (`fullHeight`).
- **Prevention:** "Sheets" in `docs/design-system.md` states the rule; `e2e/sheet.spec.ts` shortens the visual viewport and checks the panel and the last result end above it, and that the panel height does not change while the search narrows (fails without the fix, checked).
- **Status:** guarded

### L-034 · 2026-11-16 · test · The sheet's per-frame test failed on a slow runner
- **What happened:** CI's Device layout job failed on iPhone SE (WebKit) on a PR that touches no sheet code: the first sampled frame of the exercise sheet was at 324 px, above the half-viewport bound of 333.5 px. The same test had failed once before on iPhone 17 Pro Max (#98) and was left as a follow-up.
- **Root cause:** the sampler waited for its first `requestAnimationFrame` after the tap. On a busy runner that frame comes late, after the spring has already moved the panel, so "the first sample" was not the start of the animation. The assertion was right; the measurement started at an arbitrary moment.
- **Fix:** PR `m1/fix-sheet-test-race`: a `MutationObserver` takes the first sample the moment the panel is in an open dialog, before any animation frame; later samples still come one per frame. The test still fails when `overflow: clip` is removed from `.sheet-dialog` (checked).
- **Prevention:** "Tests" in `docs/conventions.md`: a per-frame sample starts from the DOM change that begins the animation, not from the first frame after the action. A failure seen once on a diff that cannot cause it is investigated then, not parked until it recurs.
- **Status:** documented

### L-033 · 2026-11-16 · test · The offline test failed on the iPhone with "WebKit encountered an internal error"
- **What happened:** on #103 the new `e2e/offline.spec.ts` passed on Chromium and failed on iPhone SE in CI at the first navigation after `context.setOffline(true)`.
- **Root cause:** Playwright's WebKit applies its offline emulation, and request routing too, before the service worker sees a navigation: a second attempt with `context.route(...).abort()` failed with "Blocked by Web Inspector". Chromium lets the worker answer both ways. WebKit runs only in CI, so neither showed locally.
- **Fix:** #103 starts its own copy of the e2e server (`e2e/site-server.ts`) and shuts it down to go offline, so no browser-level emulation is involved.
- **Prevention:** rule added under "Active rules"; with workers blocked the same spec fails at the first navigation (`ERR_CONNECTION_REFUSED`), which proves the network is gone.
- **Status:** documented

### L-032 · 2026-11-16 · pwa · The update watcher threw on every page load in e2e
- **What happened:** on #102 the Device layout job failed on both devices: Diagnostics listed "Cannot read properties of undefined (reading 'waiting')" instead of no errors.
- **Root cause:** `<ServiceWorker>` passed the value `navigator.serviceWorker.register()` resolved with straight to the update watcher. With service workers blocked (the e2e configuration), Playwright resolves `register()` without a registration. The manual check ran with workers enabled, so it did not show.
- **Fix:** #102 watches the registration from `navigator.serviceWorker.ready`, which resolves only once a worker is active and never where workers are blocked.
- **Prevention:** `e2e/diagnostics.spec.ts` expects no recorded error after opening the app, so any error thrown on load fails it on every device.
- **Status:** guarded

### L-031 · 2026-11-16 · process · A pull request was pushed with a lint error
- **What happened:** the first push of #100 failed "Check and build": `e2e/diagnostics.spec.ts` read the recorded clipboard text as `any` (`@typescript-eslint/no-unsafe-*`). A second commit fixed it before review.
- **Root cause:** `pnpm check` ran before the e2e spec was written; the spec was then run with Playwright only, which does not lint, and the branch was committed without checking again.
- **Fix:** #100's second commit types the value read from the page (`Array.isArray` then `map(String)`).
- **Prevention:** rule added under "Active rules".
- **Status:** documented

### L-030 · 2026-11-15 · ci · GitHub Actions stopped running when the month's included minutes ran out
- **What happened:** on 2026-11-15 every workflow (CI on #98, Terraform plan, the dev deploy) failed after three seconds with no log. bw found in Billing that the USD 12 of included Actions compute for November was used up; it resets on 2026-12-01.
- **Root cause:** the repository is private, so Actions minutes are billed, and nobody tracked them. The Device layout job grew with every e2e spec and ran every spec on all six devices on each PR push and again on `main`: about 10 billed minutes a run, plus 4 for the other jobs, so each merged PR cost about 30 minutes before any fix-up push.
- **Fix:** PR `m1/ci-minutes`: pull requests run the device tests on iPhone SE and Galaxy S24 only, `main` keeps the full matrix, and docs-only pull requests skip the tests while the required check still reports.
- **Prevention:** "GitHub Actions minutes" in `docs/infra.md` records the per-job cost and the retro usage check; rule added under "Active rules".
- **Status:** documented

### L-029 · 2026-11-15 · test · The swipe test passed in Chromium and failed on every iPhone
- **What happened:** the Device layout job failed on #96 on all four WebKit iPhones: after the test dragged a history set row left with `page.mouse`, the set's edit sheet was open and covered the revealed "Delete" button. Pixel 7 and Galaxy S24 (Chromium) passed, as did the local Chromium run.
- **Root cause:** Playwright's mouse in emulated mobile WebKit did not produce the drag a finger produces; the gesture ended as a tap on the row, which opens the sheet. The test simulated the wrong input, and WebKit only runs in CI (L-027).
- **Fix:** PR `m1/10-edit-past-sets`: the test swipes with touch `PointerEvent`s dispatched on the row and the window (`swipeLeft`), the input Motion's drag reads on a phone.
- **Prevention:** rule added under "Active rules".
- **Status:** documented

### L-028 · 2026-11-13 · ui · "New plan" sometimes did nothing
- **What happened:** the Device layout job failed now and then on WebKit (iPhone SE on `main`, iPhone 17 Pro Max on #79): after tapping "新建计划" the plan editor never appeared. STATUS suspected the hash being read before `router.push` updated the URL.
- **Root cause:** the static export prerenders the button, so it is visible and tappable before React hydrates the page and attaches its handler. The test tapped it right after `goto`; on a slower WebKit run the tap landed before hydration and was lost. A user opening the page on a slow phone could lose the tap the same way. Reproduced in Chromium by delaying the JavaScript chunks by 400 ms.
- **Fix:** PR `m1/plan-create-flake` renders the button only once the plan list has loaded, which happens after hydration. A new e2e test delays the chunks and taps at once.
- **Prevention:** rule added under "Active rules".
- **Status:** documented

### L-027 · 2026-11-09 · test · A plan test passed in Chromium and failed on every iPhone
- **What happened:** on #72 the Device layout job failed on the four WebKit projects: the plan row's text was not found after editing the item in its sheet. It passed on Pixel 7 and Galaxy S24, the only projects the cloud container can run.
- **Root cause:** the test asserted only the final row text, so a wrong intermediate value went unnoticed, and it ran only in Chromium before pushing. Two WebKit differences were possible: the inert page behind a modal `<dialog>` is hidden from role queries, and the select-on-focus of a tapped field may not survive the tap.
- **Fix:** PR `m1/09-plan-items` closes the sheet and waits for it to hide before checking the row. That alone did not pass: the typed rep counts were most likely appended to the old value in WebKit (see the stepper follow-up in STATUS), so the test now fills the fields and asserts each stored value before moving on.
- **Prevention:** rule added under "Active rules".
- **Status:** documented

### L-026 · 2026-11-09 · ui · The plan editor did not show new days
- **What happened:** writing the plan editor's e2e test, renaming a day and adding a day were stored in IndexedDB but the screen kept the old rows; renaming the plan did update it.
- **Root cause:** the editor's loader first awaited our own async helpers (`repos.plans.get`, an `activePlan` helper), then read the days. `liveQuery` records which tables a query reads through Dexie's async context, and that context did not survive awaiting the helpers' native promises, so the later reads of `planDays` and `planItems` were not observed. Only the `plans` read, made first, was.
- **Fix:** PR `m1/09-plan-editor`: the plan loaders in `src/db/plans.ts` read every table with direct Dexie calls.
- **Prevention:** rule added under "Active rules" and in "Data on the device" in `docs/conventions.md`; `e2e/plans.spec.ts` renames and adds a day and fails without the fix.
- **Status:** guarded

### L-025 · 2026-11-09 · ui · The workout in progress had no way back
- **What happened:** after starting a workout and adding an exercise, the Workout tab showed only the workout, whose one exit was "Finish workout". bw could not get back to the tab's home or the library without ending the workout. Found by bw on the iPhone.
- **Root cause:** M1-05 replaced the tab's content with the active workout instead of giving it its own page, and nothing checked that every screen can be left.
- **Fix:** PR `m1/05-workout-back` moves the workout to `/workout/session` with a back link; the tab shows "Continue workout"; the finish sheet can also discard the workout.
- **Prevention:** rule added under "Active rules"; `BackLink` component; `e2e/layout.spec.ts` checks the back link of every page listed with a parent.
- **Status:** guarded

### L-024 · 2026-11-09 · test · The workout e2e test failed once in CI
- **What happened:** on #67 the Device layout job failed on Pixel 7 only: the note saved in the sheet was missing after the reload. The first fix then failed locally on repeat, because the locator also matched the note's text field in the closing sheet.
- **Root cause:** the test clicked "Save" and navigated at once, while the Dexie write was still in flight; leaving the page abandoned it. The test had been run once per device before pushing, which hid the timing.
- **Fix:** #67 waits for the note's paragraph on the card and for the picked kind chip's `aria-pressed` before leaving the page.
- **Prevention:** rule added under "Active rules": wait for the stored value to show before navigating, and run new e2e tests with `--repeat-each` before pushing.
- **Status:** documented

### L-023 · 2026-11-09 · ui · The sheet kept flashing because its dialog scrolled
- **What happened:** after L-020 the sheet still flashed on the iPhone. A first follow-up (PR `m1/04-sheet-entry-after-open`, starting the animation after `showModal()`) changed nothing. bw's 60 fps screen recording showed the panel appear at its final place, slide up off the top, then snap back.
- **Root cause:** a modal `<dialog>` is a scroll container (UA `overflow: auto`). The panel starts translated below the dialog, so the dialog became scrollable and the browser scrolled it to show the panel; as the panel rose, the scroll range shrank until it snapped to 0. Chromium did the same (the first measurement showed the panel's top fixed at 40 px during the "animation"), but the move was smooth there, and the reading was misinterpreted. Both earlier fixes were guesses that were not checked against a measurement of the failure.
- **Fix:** PR `m1/04-sheet-dialog-clip`: `.sheet-dialog { overflow: clip }`, which cannot scroll; the `useAnimationControls` change is reverted. `focus({ preventScroll: true })` (L-020) stays as good practice.
- **Prevention:** `e2e/sheet.spec.ts` samples every frame of the opening on all six devices (WebKit in CI) and fails if the dialog scrolls or the panel does not start in the lower half. It fails without the fix. New Active rule: measure the failure before fixing it, and keep the measurement as a test.
- **Status:** guarded

### L-022 · 2026-11-09 · ci · An older commit's deploy overwrote a newer one on dev
- **What happened:** bw reinstalled the app and still had no muscle picker. #56 merged before #55, but its CI finished later, so its deploy ran after #55's and put the older commit back on dev. Both deploys reported success.
- **Root cause:** `deploy.yml` deploys whichever commit's CI just passed. The concurrency group only orders the deploys by when they start, not by commit order, and nothing checked that the commit was still current.
- **Fix:** PR `m1/deploy-latest-only`: a first job compares the commit with the tip of `main` and skips the deploy when it is older; the rerun of #55's deploy restored dev.
- **Prevention:** the check is part of the workflow, so every deploy goes through it.
- **Status:** guarded

### L-021 · 2026-11-09 · ui · A focus ring stayed on a row after closing its sheet
- **What happened:** bw closed an exercise sheet on the iPhone and the row that opened it kept a blue focus ring.
- **Root cause:** a closing modal `<dialog>` returns focus to the element that had it, and WebKit treats that programmatic focus as `:focus-visible` even after a tap. Chromium does not, so the desktop check missed it.
- **Fix:** PR `m1/04-sheet-open-flash`: `src/instrumentation-client.ts` marks `<html data-input="keyboard">` on key presses and clears it on pointer input; the focus ring in `globals.css` applies only then.
- **Prevention:** the ring rule itself depends on the input mode, so every element gets the same behaviour.
- **Status:** guarded

### L-020 · 2026-11-09 · ui · The sheet flashed open, vanished and then slid in
- **What happened:** after L-019, bw saw every sheet on the iPhone appear for a moment, disappear, and then rise correctly.
- **Root cause:** the L-019 fix focuses the panel right after `showModal()`, while the panel is still translated below the screen for its entry animation. WebKit scrolls a focused element into view, so the panel showed for a frame before the animation moved it back down. Desktop Chromium does not scroll there, so the check in Chromium did not show it.
- **Fix:** PR `m1/04-sheet-open-flash`: `focus({ preventScroll: true })`.
- **Prevention:** an ESLint rule in `eslint.config.js` rejects any `focus()` call in the web app without `preventScroll`.
- **Status:** guarded

### L-019 · 2026-11-09 · ui · The first bottom sheet raised the keyboard and let the page scroll behind it
- **What happened:** bw opened the exercise sheet on the iPhone: the keyboard came up at once and pushed the sheet off screen, swiping scrolled the library behind the sheet, and there was no visible way to close it.
- **Root cause:** `showModal()` focuses the first focusable element, which was a text field, and iOS opens the keyboard for any focused field. A modal `<dialog>` makes the page inert but does not stop it scrolling on iOS. The sheet was checked in desktop Chromium only, where neither shows, and the scrim was the only close control besides Escape, which a phone does not have.
- **Fix:** PR `m1/04-sheet-fixes`: the sheet focuses its own panel after opening, `html:has(.sheet-dialog[open])` stops page scroll, and it closes with a close button or a downward drag of its header.
- **Prevention:** "Sheets" in `docs/design-system.md` now lists these three requirements, and they live in the one `Sheet` primitive every sheet uses. New Active rule.
- **Status:** documented

### L-018 · 2026-11-09 · motion · Reduce Motion tab switches overlapped the text of two screens
- **What happened:** bw turned on Reduce Motion on the iPhone after M1-03; switching tabs, the text changed slowly and felt uncomfortable.
- **Root cause:** the reduced-motion rule turned the tab transition into a 200 ms fade out of the old screen and fade in of the new one at the same time, so both screens' text was visible on top of each other. "Every motion becomes a fade" was applied to a whole-screen change without asking whether a fade suits it; the check in Chromium measured the animation names and durations, not how it reads.
- **Fix:** PR `m1/03-reduced-motion-tabs`: under Reduce Motion the view transition pseudo-elements do not animate, so the screen swaps at once (as the Next.js view transitions guide recommends).
- **Prevention:** new Active rule; the exception is written into "Motion" in `docs/design-system.md`.
- **Status:** documented

### L-017 · 2026-11-07 · pwa · Test steps told bw to type a URL into the installed app
- **What happened:** The M0-13 handover asked bw to open `/dev/rest-timer.html` by typing the address inside the home-screen app. bw asked whether to delete and re-add the app; an installed web app has no address bar and always opens at the manifest `start_url`, so the page was unreachable.
- **Root cause:** The steps were written for a browser tab, not for the standalone app the test required. No rule said how bw reaches a page on the iPhone.
- **Fix:** PR `m0/13-dev-page-links` (dev builds link the dev pages from the home page); corrected in chat.
- **Prevention:** new Active rule; every new dev page gets a link from the dev home page (`src/app/page.tsx`).
- **Status:** documented

### L-016 · 2026-11-06 · pwa · The status bar blur still covered the title after L-015
- **What happened:** after the L-015 fix bw re-installed the app; the title was below the status bar but still partly blurred.
- **Root cause:** L-015 treated the blur as a strip of fixed height and added a gutter. iOS 26+ instead paints a progressive "scroll pocket" blur over the top of an installed web app, well below the status bar, and removes it only when an opaque `position: fixed` element touches the top edge across at least 80% of the width. Nobody looked up how the current iOS draws installed web apps before fixing; the first fix was a guess.
- **Fix:** PR `m0/launch-polish`: a fixed `.status-bar-fill` strip in the root layout, the status bar's height, in `--bg`.
- **Prevention:** before fixing platform rendering behaviour (iOS/Android/browser chrome), search for the current platform's documented behaviour and cite it in the PR; the cross-device QA work (`m0/device-qa`) adds automated device checks.
- **Status:** documented

### L-015 · 2026-11-06 · pwa · The page title sat under the iOS status bar blur
- **What happened:** after M0-12 bw installed the app on the iPhone; the "Gainframe" heading started at the very left edge and directly under the status bar, where iOS blurs the content, so it was hard to read.
- **Root cause:** `body` was padded by exactly the safe-area insets, with no gutter, although the prototype pads screens by the inset plus 20 px. The Chromium check could not catch it: desktop Chromium reports zero safe-area insets.
- **Fix:** PR `m0/12-safe-area-spacing`: `body` padding is the inset plus `--space-20` at the top and bottom and `max(--space-20, inset)` at the sides.
- **Prevention:** "Screen edges" in `docs/design-system.md` states the padding rule; anything that depends on safe areas is verified on the iPhone, not in a desktop browser.
- **Status:** documented

### L-014 · 2026-11-06 · ci · The smoke test passed while the API could not reach its database
- **What happened:** bw opened `/api/health` on dev and got `{"status":"error","database":"unreachable"}`. The deploy logs of 2026-11-04 and 2026-11-05 both show `curl: (22) ... 503`, yet the smoke test passed. CloudWatch showed `password authentication failed for user 'neondb_owner'`: the Neon `dev` branch behind the SSM connection string no longer existed. The Neon console creates a branch with "Auto-delete: after 1 day" by default.
- **Root cause:** the health request ran as `$(curl -f ... | tr | awk)`. Bash takes a pipeline's exit status from its last command, so curl's failure was discarded and the step only checked that a request ID came back. The smoke test asserted that the API answered, not that it was healthy. Separately, the dev setup steps never mentioned the Neon branch, so its auto-delete default went unnoticed.
- **Fix:** PR `m0/smoke-test-health`: the smoke test requires status 200 and `database: connected`, with curl outside any pipeline. bw recreated the `dev` branch with auto-delete off and wrote its connection string to SSM; `infra/envs/dev/README.md` now names the branch and the setting.
- **Prevention:** in workflow scripts, never put a command whose failure matters inside a pipeline or `$(...)` with other commands; capture its output to a file first. A smoke test asserts the healthy result, not just a response.
- **Status:** guarded (the smoke test fails on an unhealthy API)

### L-013 · 2026-11-04 · ci · The first deploy's smoke test failed on CLI output
- **What happened:** the first run of `deploy.yml` deployed correctly and found the access line, then failed in `jq`: `aws logs filter-log-events --output text` printed the message and a second line `None`. Found in CI.
- **Root cause:** the AWS CLI paginates this call by default, and text output prints the queried value once per page. The step was linted but never run, because `workflow_run` workflows only run from `main`.
- **Fix:** follow-up PR to M0-10 queries with `--output json` and picks the first event with `jq`.
- **Prevention:** rule added under "Active rules": parse AWS CLI results as JSON (`--output json` + `jq`), never text output.
- **Status:** documented

### L-012 · 2026-11-04 · infra · The CI roles' trust policies never matched GitHub's OIDC subject
- **What happened:** the first workflow to assume `gainframe-ci-plan` (M0-10) failed with "Not authorized to perform sts:AssumeRoleWithWebIdentity". Decoding the token in the job showed the subject `repo:brianwong0819@59221587/gainframe@1439499232:pull_request`; the trust policies from M0-07 expected `repo:brianwong0819/gainframe:pull_request`. Found in CI.
- **Root cause:** the trust conditions were written from the documented legacy subject format, and M0-07's Verify checked only that the roles existed, not that a workflow could assume them. GitHub sends the immutable form (owner and repository IDs) for this repository.
- **Fix:** PR for M0-10 pins both trust policies to the immutable subject.
- **Prevention:** the plan workflow assumes the plan role on every infrastructure pull request, and the deploy assumes the apply role on every merge, so a trust mismatch now fails a check. Rule added under "Active rules": verify an identity or permission change by exercising it from the real caller, not by reading the resource.
- **Status:** guarded

### L-011 · 2026-11-03 · infra · The dev first-apply steps failed on bw's machine
- **What happened:** following `infra/envs/dev/README.md`, `pnpm build` failed with "Command build not found" and `cd infra/envs/dev` failed, because the terminal was in `C:\Users\brian`. Then `terraform init` and `curl.exe` to CloudFront failed with connection resets over IPv6. Found by bw during the M0-08 apply.
- **Root cause:** the steps said "from the repository root" without a `cd` command, and were checked only in the cloud container (bash, a different network). Nothing covered a provider download failing.
- **Fix:** the README now starts with `cd C:\dev\gainframe` and `git pull`, uses `curl.exe -4`, and documents installing providers with `terraform init "-plugin-dir=..."`; the bootstrap README names its folder.
- **Prevention:** rule added under "Active rules": every command block for bw starts with `cd` to an absolute path and gives the fallback for each download.
- **Status:** documented

### L-010 · 2026-11-03 · infra · A Terraform flag broke in PowerShell
- **What happened:** the M0-07 first-apply steps used `terraform plan -out=bootstrap.tfplan`; in PowerShell it failed with "Too many command line arguments". Found by bw during the apply.
- **Root cause:** PowerShell splits an unquoted argument that starts with `-` at the `.`, so Terraform received two arguments. The steps were checked with bash in the cloud container, not PowerShell.
- **Fix:** PR for M0-07 quotes the argument in `infra/bootstrap/README.md`.
- **Prevention:** rule added under "Active rules": quote `-flag=value.ext` arguments in every PowerShell command given to bw.
- **Status:** documented

### L-009 · 2026-11-02 · process · Plan and code problems surfaced in a batch
- **What happened:** the maintainability review before M0-06 found a dozen issues at once (no logging design, an alarm that could never fire, an ADR number collision, a `.env` deny gap). bw asked for regular, proactive reviews so problems do not pile up until late.
- **Root cause:** reviews were scheduled only at milestone retros; no step in a task checked whether the change affected later ROADMAP tasks.
- **Fix:** PR for M0-06.
- **Prevention:** "Look ahead" step added to the work loop in `CLAUDE.md` and to `/finish-task` (check affected later tasks; whole-repository review at each milestone's midpoint); `/retro` now walks the next milestone's tasks against the current code.
- **Status:** documented

### L-008 · 2026-11-02 · process · A PR shipped from an auto-generated branch name
- **What happened:** the M0-05 PR (#4) used the cloud session's branch `claude/project-thread-8yxg8c`; bw asked why the name was so odd.
- **Root cause:** the session's suggested branch was used instead of the convention in `docs/conventions.md`.
- **Fix:** later work uses `m0/...` branches.
- **Prevention:** rule added under "Active rules"; `/start-task` already creates the branch by convention.
- **Status:** documented

### L-007 · 2026-11-02 · process · Two documents claimed ADR-0001
- **What happened:** ROADMAP M0-13 and `architecture.md` reserved ADR-0001 for sync rules, but M0-03 used ADR-0001 for the AWS account model. Found in the maintainability review.
- **Root cause:** ADR numbers were assigned in the plan before the ADRs existed; writing ADR-0001 did not trigger a search for other references.
- **Fix:** planned ADRs renumbered (sync 0002, PWA 0003, iOS timer 0004) in PR `m0/review-maintainability`.
- **Prevention:** rule added under "Active rules": cite planned ADRs by topic, numbers only once written.
- **Status:** documented

### L-006 · 2026-11-02 · tooling · Claude Code could read `apps/api/.env`
- **What happened:** `.claude/settings.json` denied `Read(./.env)` at the repository root only. M0-05 added `apps/api/.env` (the database URL), which the patterns did not cover. Found in the maintainability review; no secret was read.
- **Root cause:** the deny list was written before the monorepo had per-app env files, and M0-05 did not re-check it.
- **Fix:** patterns changed to `./**/.env` and friends in PR `m0/review-maintainability`.
- **Prevention:** rule added under "Active rules". gitleaks in CI (M0-06) is the automated backstop for anything committed.
- **Status:** documented

### L-005 · 2026-11-02 · process · A password appeared in a shared screenshot
- **What happened:** following CLI instructions that included a password argument, bw shared a terminal screenshot that showed the typed password. The command failed, so the password was never set.
- **Root cause:** the instructions put a secret on the command line and did not say what to hide before sharing output.
- **Fix:** bw was told not to reuse that password anywhere.
- **Prevention:** instructions never put secrets on a command line when a prompt or console form exists, and every request for a screenshot or output names what to mask (rule added under "Active rules").
- **Status:** documented

### L-004 · 2026-11-02 · infra · M0-03 was planned against the old AWS account model
- **What happened:** ROADMAP M0-03 told bw to create an IAM Identity Center admin user and work in `ap-southeast-1`. On the 2026 account plan, Identity Center and IAM-user console passwords are blocked by AWS-managed SCPs, and the account was region-locked to `ap-southeast-2`. Several attempts (an IAM user, CloudShell `create-login-profile`) failed before the cause was found.
- **Root cause:** the account steps were written from memory of the pre-2026 account model; AWS's current sign-up and account-plan docs were not read while planning.
- **Fix:** advanced features activated and the Region SCP edited ([ADR-0001](adr/0001-aws-account-model.md)); `docs/infra.md` and `docs/setup-windows.md` updated.
- **Prevention:** `docs/infra.md` now records the account structure and guardrails; rule added under "Active rules" to read the vendor's current docs before planning console or account steps.
- **Status:** documented

### L-003 · 2026-10-30 · tooling · User-level installs from a remote session did not reach bw's terminal
- **What happened:** fnm's Node 24 and pnpm were installed through a remote session and reported working, but in bw's own PowerShell `fnm list` showed only `system`.
- **Root cause:** the remote session's user environment (fnm directory / PATH) differed from bw's interactive shell; the check ran in the session's shell, not bw's.
- **Fix:** bw re-ran `fnm install 24; fnm default 24; corepack enable` in their own terminal.
- **Prevention:** after any remote install, the final check is run by bw in a freshly opened terminal; per-user tools (fnm, Node, pnpm, shell profile) are installed in bw's own terminal.
- **Status:** documented

### L-002 · 2026-10-30 · process · Reported a repo move as correct when `.git` was missing
- **What happened:** after bw moved the repo to `C:\dev\gainframe`, Claude listed the folder, saw the expected files and said it was correct. The `.git` folder was gone, so it was not a git repository.
- **Root cause:** checked by eye against a file list instead of running the check the doc itself gives (`git status`); "the files look right" was taken as proof.
- **Fix:** re-clone from GitHub; setup doc already says to verify with `git status`.
- **Prevention:** verify with the real command's output, never by inspecting a listing (rule added under "Active rules").
- **Status:** documented

### L-001 · 2026-10-30 · tooling · Setup guide assumed `winget` exists
- **What happened:** bw ran `winget install --id Git.Git` from `docs/setup-windows.md` and got "winget is not recognized".
- **Root cause:** the guide was written for a fresh, fully updated Windows and never checked its own prerequisites; it also skipped "open a new terminal after installing" and the PowerShell profile/execution-policy steps.
- **Fix:** PR `m0/02-winget-fallback`.
- **Prevention:** setup docs start each section with a one-line check of their prerequisite and give the fallback when it fails (rule added under "Active rules").
- **Status:** documented

## Retros

At the end of each milestone, append a short retro here:

```md
### Retro M0 · YYYY-MM-DD
- Lessons this milestone: L-00x, L-00y
- Promoted to rules: …
- Rules removed or rewritten: …
- What slowed us down most / what to try next milestone: …
```

### Retro M0 and M1 · 2026-11-16
M0 had no retro of its own, so this one covers both milestones.
- **Lessons:** L-001 to L-014 (M0), L-015 to L-033 (M1). Nine of the M1 lessons share one root cause: the cloud container runs Chromium only, so failures in WebKit or on the iPhone surfaced in CI or in bw's hands. The rest group into e2e timing, steps written for bw, workflow scripts and process.
- **Promoted to rules:** WebKit-green before a UI change is done, `pnpm check` last before a commit, measure a glitch before fixing it, read current vendor docs (`CLAUDE.md`); e2e and hydration rules (`docs/conventions.md`); workflow script rules and public logs (`docs/infra.md`); steps for bw (`CLAUDE.md` environment notes). "Active rules" went from 28 entries to one, plus a table of where the others live.
- **Removed or rewritten:** the Actions minutes rule (the USD 12 cap applied only while the repository was private); the ADR numbering rule (L-007, one-off, no ADR has been mis-numbered since); `docs/conventions.md` no longer says e2e goes offline with `context.setOffline` (contradicted L-033); `docs/STATUS.md` was a 50 KB changelog read at the start of every session and now holds only the current state, with a line budget in its header and in `/finish-task`.
- **Guards added:** none new in this retro; L-020 (lint), L-022, L-025, L-026, L-032 (tests) were already guarded. Candidate: a WebKit run in the cloud container would turn most of the WebKit lessons into local failures, but the container's Playwright ships Chromium only and must not be reinstalled.
- **Dependencies (`pnpm outdated -r`):** only patch and minor updates (Next 16.4.6, Motion 14.14, Playwright 1.65, Vitest 5.1, Prettier 3.10, rolldown 1.3, next-intl 4.15). TypeScript 7 waits for `typescript-eslint` support; `@types/node` stays on 24 to match the Node 24 runtime. Proposed: one bump PR at the start of M2.
- **Cost:** AWS month-to-date is checked by bw in the Billing console (the cloud container has no AWS credentials). Actions: November's included minutes ran out on 2026-11-15 (L-030); free since the repository went public.
- **What slowed us down most:** WebKit-only e2e failures (each one cost a CI round trip and often a second fix) and a STATUS file that grew with every PR. Next milestone: read WebKit results before handing over, keep STATUS short.
