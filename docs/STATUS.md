# Status

The handover note between sessions: where the project is now, what waits on bw, and what was noticed but not done. It is not a changelog. What each task built is in its PR and its ROADMAP entry; where code lives is in `docs/architecture.md`. Keep this file under 100 lines: replace the "Now" section at the end of each task instead of appending to it.

- **Milestone:** M2 Accounts + sync (bw's device checks) and M3 Food logging
- **Current task:** M3-06 confirm screen built (photo screen, oil and sauce row, name-correction sheet with "remember this correction", small / regular / large for low-confidence items); ticked after bw logs a real meal; M3-03 offline photos built (PR `m3/03-offline-photos`). M3-04 is done: dev calls Claude Haiku 5.5 through Anthropic's API (ADR-0008), first real call ok on 2026-11-27; prod still needs its own key (`infra/envs/prod/README.md`). The real checks of M3-03, M3-05, M3-06 and M3-10 are now bw logging real meals; M3-08 `pnpm eval:vision` built (PR `m3/08-eval-vision`), its first real run waits on the M3-09 photos
- **M4 in parallel** (no AI needed): M4-02 and M4-04 done (Progress page below Today, weight page with the chart, weekly list, composition change and the food-log check); next M4-06 strength chart, M4-07 volume and protein charts and M4-08 muscle map (designed 2026-11-28), each in its own thread
- **Last updated:** 2026-11-28

## Now

State on 2026-11-27, after the global review (PR `m3/review-thread-rules`). What each task built is in its PR and ROADMAP entry.

- **M0, M1 (except M1-13 and M1-14), M2-01 to M2-06 and M2-08 to M2-10** are merged. The app works offline on the device, with optional sign-in (email or Google, Cognito managed login with PKCE, ADR-0007) and backup through `/api/sync/push` and `/api/sync/pull` (ADR-0003). The current plan is synced as `plans.activatedAt` (L-051).
- **M1-13** ended on 2026-11-22 by bw's choice: problems found in daily use are fixed as they come up; the field week checklist below stays as the open iPhone checks. **M1-14** (timed and cardio logging) comes after M2.
- **M2-07 prod** is done: prod first deployed on 2026-11-27 (PR #206, L-053) and passed its smoke test, database and AI checks included. With ADR-0009, prod deploys automatically after dev.
- **M3**: M3-01, M3-02, M3-04, M3-11, M3-12 and M3-13 are done. M3-03 (offline photos), M3-05 (photo estimate), M3-06 (confirm screen) and M3-10 (text estimate) are built and ticked after bw logs real meals on dev. M3-08 `pnpm eval:vision` is built; its first real run waits on the M3-09 photos. AI calls go to Anthropic's API (ADR-0008) and only for the Cognito group `ai` (M3-13).
- **M4**: M4-02 (weigh-ins) and M4-04 (Progress page and weight chart, visx; shared `Plot`, `SegmentedControl`) are done; M4-01 part (a) is merged. Next are M4-06 and M4-07, which reuse `src/ui/plot.tsx`.
- **Layout review 2** (2026-11-28): bw approved all 12 fixes, each in its own PR. Done: Martian Mono only for hero figures (PR `m4/review-number-font`); food add dock band, quieter blue accents (PR `m4/review-food-dock`); top set shown once on summary cards and Today's protein card first with a one-row workout (PR `m4/review-summary-today`); one selection control and food copy (PR `m4/review-selection`).
- **Dark atmosphere** (2026-11-28, bw chose all three): dark mode's static cobalt glow and translucent groups done (PR `m4/review-dark-glow`, "Dark glow" in `docs/design-system.md`); the tab bar is a floating capsule in both themes (PR `m4/floating-tab-bar`); the verdict line is its own PR.
- **Thread rules**: one project thread per small task, with a short handoff once the context grows ("Project threads" in `docs/working-with-claude.md`).

## Field week checklist (pending iPhone checks)

Checks that earlier PRs left for bw on the iPhone. Each one is part of M1-13; a failure becomes an issue.

- Home-screen install: opens full screen with the splash screen, status bar matches the background, opens in airplane mode.
- Tabs: switching is smooth in light and dark, with Reduce Motion on and off; English shows no Chinese.
- Library: search, muscle filters, new and edit sheet with the keyboard up, detail sheet with cues and the muscle map.
- Workout: a set logged one-handed in 5 s or less; the stepper's typed digits replace the value instead of being appended (see Follow-ups).
- Plans: make a plan, start its next day from the Workout tab, finish, see the following day offered; add an exercise from its detail.
- Rest timer: the cue and the blue pill on screen; the overdue rest after locking the phone or opening another app and coming back now beeps once (L-037); the cue still plays after switching away and back earlier in the workout (L-038).
- Supersets: link two exercises in a workout and in a plan; the superset sheet opens to set rounds and rest; the rest opens only after the last exercise of each round; "加一轮" adds a set to each exercise.
- Finish: the plates and the "新纪录" tag feel right; the rest sheet's wait after a celebration is not annoying.
- History: the swipe to delete does not fight vertical scrolling; editing a past set updates its figures.
- Design review: the workout header and finish prompt, the Workout and Today tabs, the summary's comparison with last time, the compact history, the rest sheet's next set, the plan editor's pencil and day menu, and the library's best sets all read well and nothing is cut off.
- Settings: Diagnostics shows errors and copies a report; the export saves to Files; "A new version is ready" appears after a deploy and updates.

## Blocked on bw

- Move the dev records to prod: on dev, Settings → Diagnostics → Export all data; on prod (signed in), Settings → Diagnostics → Import from a file (M2-11). Also check that the iPhone's file picker shows the exported JSON.
- Install the prod app on the iPhone (Safari, the prod URL from the Deploy run's Apply step, Share → Add to Home Screen) and add your account to prod's Cognito group `ai` to use AI there.
- Log a real meal by photo, by a sentence and by a photo taken in airplane mode on dev (ticks M3-03, M3-05, M3-06, M3-10).
- If not done yet: add your account to the Cognito group `ai` (User pool, Groups, `ai`, Add user) and sign out and in once (M3-13); subscribe an email to each alarm topic (M2-08, `docs/debugging.md`).
- The black flash when returning to the app: in light mode, is the flash white (an iOS limit, no change) or black (an app cause)?
- Settings → Code security: enable Dependabot alerts and Dependabot security updates.

## Follow-ups (noticed, not in scope yet)

- The add-food page keeps chips for the meal type (`ChoiceGroup chips`). With the taller segmented control, CI's iPhone SE (WebKit) test "a search finds a food table entry, and one tap adds its serving" failed twice: the tap on "记入…" left the page on /food/add. Suspected, not measured (L-023): the page is taller, so the dock is pinned, and when the search field loses focus the tab bar returns and the dock jumps up between press and release. Measure in WebKit (per-frame position of the dock around the tap); if confirmed, fix the dock so it does not move on blur, then switch the page to segments.
- AI tokens (2026-11-27): the first `pnpm eval:vision` run compares vision v3 (entries named by position) with v2 (`--prompts 2,3`) and the text set; v3 is served before it, by bw's choice. The image size sent to the model (about 1,000 to 2,500 tokens of the 48,000 per photo) is chosen in the same run.
- Seven foods appear twice under the same name from two sources with different figures (Langsat, Salak, Mysore pak, Idli, Beef burger, Coleslaw, Samosa); the SG FoodID curation meant to leave out foods MyFCD already has. Decide per pair which to keep.
- Weight chart reading in WebKit: each new reading takes 25 to 60 ms in CI WebKit (L-056, measured in draft PR #213). Find the cause (next: the header text that changes on each reading), then set `P95_FRAME_MS` in `e2e/weight-chart.spec.ts` back to 34 ms and drag only over days with data. Check on the iPhone that reading the chart feels smooth.
- The "和饮食对一下" card writes its causes for gaining only; maintain and cut show the energy and protein lines without a cause.
- The first AI call after the dev database had been idle failed in `ai_usage.reserve` with "Failed query" (Lambda request c9a791c8, 2026-11-27); the same call a minute later succeeded. Probably a connection dropped while Neon's compute was suspended. Measure first (log the pg error's `code` and `cause`, which Drizzle's wrapper hides), then decide on a retry for connection errors in `createPool` or the AI pipeline (L-023).
- A kept photo confirmed on a later day says "记入后今天蛋白质…" with the figures of the photo's day; the line should name that day.
- Photo confirm screen (M3-06), left out of the first version: the "+ Add food" row (the manual screen would need the estimate kept across pages), the line on a row that used a remembered correction (the endpoint does not say which corrections it applied), and the Undo toast on the Food tab after saving.
- Stepper typing (`src/ui/stepper.tsx`) selects the value on focus, but in WebKit the tap that focused the field may clear that selection, so typed digits are appended ("8" then "5" gives "85"). Check on the iPhone during M1-13 and fix in the stepper if confirmed.
- A day's estimated length (`estimateDayS`) counts a rest after every set of a superset member, although a superset rests only after each round, so a day with supersets is estimated too long.
- Plan days keep the order they were added in; exercises can be reordered, days cannot yet.
- The spacing scale has no 44 px step, so a 44 px tap target comes from padding (`py-12` around 15 px text). Consider a `--tap` size token when a third component needs one.
- `theme-color` and the splash screens follow the system colour scheme, not a theme forced with `data-theme`; revisit if Settings adds a theme switch.
- TypeScript is pinned to 6.0 because `typescript-eslint` 8.72 supports `<6.1`; move to TypeScript 7 once it does.
- `eslint-config-next` bundles plugins whose peer ranges stop at ESLint 9, so `pnpm install` prints a peer warning; lint runs clean. Re-check on each Next upgrade.
- The health response shape is declared in `apps/api`, not as a schema in `packages/shared`; move it there when the web app first consumes an API response.
- The two search fields (library page, exercise picker) repeat the same input markup with different backgrounds. Extract a `SearchField` in `src/ui` if a third one appears (M3-02 frequent foods).
- The dev site and function URLs appear in the dev deploy's public Actions logs (Terraform outputs). Nothing secret; `/api/health` no longer queries the database, and every other API route will require a token (M2-03).
