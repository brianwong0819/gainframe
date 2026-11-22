# Status

The handover note between sessions: where the project is now, what waits on bw, and what was noticed but not done. It is not a changelog. What each task built is in its PR and its ROADMAP entry; where code lives is in `docs/architecture.md`. Keep this file under 100 lines: replace the "Now" section at the end of each task instead of appending to it.

- **Milestone:** M1 Workout logging (code complete)
- **Current task:** M1-13 Field week (bw logs every session for a week)
- **Last updated:** 2026-11-22

## Now

M0 and M1-01 to M1-12 are merged. The app runs offline on the device only: exercise library, plans, workouts with rest timer, supersets, summary and records, history with editing, Settings with Diagnostics and a JSON export. Nothing syncs yet; every write also queues an outbox entry for M2.

The M1 review and retro (2026-11-16, PRs `m1/review` and `m1/retro`) found no data-loss or security defect in the code. Changes: the "ask twice" button is one shared `ConfirmButton` (plan editor and past workout), the device time zone is read in one place (`src/i18n/time-zone.ts`), the data model in `docs/architecture.md` lists the columns M1 added, this file was cut from a changelog to the current state, and lessons L-001 to L-033 were grouped and promoted (retro in `docs/LESSONS.md`).

Health check (2026-11-16, PR `m1/health-limit`, moved forward from M2-09 by bw because the repository is public): `GET /api/health` returns `{ "status": "ok" }` without touching the database; the deploy smoke test checks the database by invoking the function directly with `{ "check": "database" }`, which needs IAM. Locally, `pnpm --filter api dev` logs the database check at start-up.

Clear data (2026-11-16, PR `m1/clear-data`, asked by bw for the field week): Diagnostics → "Clear all data" (two taps) empties every Dexie table and reopens the app at Today, so a reset no longer needs reinstalling the Home Screen app. It is shown in every build, not only with `GAINFRAME_DEV_PAGES`: a local-only app needs a way to erase its data, and the button sits on the developer-facing Diagnostics page. M2-05 revisits it for sync.

Design review (2026-11-16, asked by bw during the field week): every screen was captured and compared with a proposed version, and bw chose all ten changes. They land as small PRs outside the numbered tasks, in this order: (1) workout header with elapsed time, set progress and the finish button, and a finish prompt once every set is done — PR `m1/design-session-header`; (2) Workout tab: this week's days, last time's figures, a prominent workout in progress; (3) Today shows the next workout, the week and recent records; (4) summary compares with the last time the day was done; (5) compact history cards with month totals; (6) the rest sheet previews the next set; (7) plan editor and library tidy-ups. Across all of them, units are set smaller than their numbers. The mock's side-by-side steppers were dropped: beside 44 px buttons a three-digit weight ("102.5") does not fit at 390 px unless the number shrinks to 18 px, so the steppers stay stacked at full size and the panel only loses the unit pill's height. All ten are implemented (#109 to #115 and `m1/design-library`); bw checks them on the iPhone during the field week.

Dependency update (2026-11-22, PR `m2/dependency-update`): every package moved to its latest patch or minor release, which takes Next.js 16.4.6 past the security advisory `next build` reported on 16.4.4. TypeScript stays on 6.0 and `@types/node` on 24 (see Follow-ups).

M1-13 ended on 2026-11-22 by bw's choice: problems found in daily use are fixed as they come up. M1-14 (timed and cardio logging) moves after M2, also by bw's choice. The field week checklist below stays as the list of iPhone checks still open.

M2-01 (2026-11-22, PR `m2/01-neon-drizzle`): the Drizzle schema in `apps/api/src/db/schema.ts` mirrors the seven synced Dexie tables plus `server_version`, with a server-only `sync_state` table; the first migration is `apps/api/drizzle/0000_initial.sql`. The deploy migrates dev before `terraform apply`; the runner connects directly (not through Neon's pooler) and sets the role's 8 s `statement_timeout`. The Neon `prod` branch moved to M2-07.

Next: M2-02 (Cognito).

Food logging design (2026-11-16, PR `m3/food-design`, documents only): the M3 screens were designed ahead of the milestone and bw chose the options; the specification is "Food logging" in `docs/design-system.md`. ROADMAP changes: M3-02 gains the daily targets and the Today protein card, M3-03 keeps offline photos for a later estimate, and M3-10 (text estimate) moves in from the post-MVP list.

Sign-in and backup design (2026-11-17, PR `m2/sign-in-sync-design`, documents only): the M2 screens were designed ahead of the milestone; the specification is "Accounts and backup" in `docs/design-system.md`. bw chose the recommended option of all four decisions: sign-in stays optional, email uses managed login, the status is one quiet icon, and unsent changes warn instead of blocking. ROADMAP changes: M2-02, M2-05 and M2-06 point at the specification, and M2-10 (account deletion) is added.

Progress charts design (2026-11-17, PR `m4/charts-design`, documents only): the M4 chart screens were designed ahead of the milestone; the specification is "Progress charts" in `docs/design-system.md`. ROADMAP changes: M4-04 is split into M4-04 (Progress page and weight chart), M4-06 (strength chart) and M4-07 (volume and protein charts), because one task could not stay under 400 lines. bw chose the recommended options: a Progress page below Today instead of a fourth tab, estimated 1RM as the default strength measure and working sets as the default volume measure.

Superset settings (2026-11-17, asked by bw during the field week): a superset's rounds and rest belong to the superset, not to each exercise. In the plan editor its heading shows "4 轮 · 休息 1:30" and opens a sheet for both; joining two exercises opens that sheet; a member's sheet keeps only its rep range and note. Existing supersets take the longest rest and the most sets of their members (Dexie version 9). In a workout the heading shows the round and the rest and opens the rest; joining opens it and gives every member as many sets as the one with the most; a superset's "加一组" becomes "加一轮", a set for each member (PRs `m1/superset-plan` and `m1/superset-workout`).

Exercise library expansion (2026-11-17, asked by bw): the built-in catalog grows from 64 to 157 strength exercises in four data PRs (push; pull; legs; core, full body, kettlebell and bands), each with names, aliases, muscles, equipment, rest and form cues. The library now groups built-in exercises by primary muscle, since new IDs can only be appended, and a test forbids a name or alias shared by two exercises. Left out on purpose: assisted pull-up and dip machines (the logged weight is assistance, so records would run backwards), the hip adduction machine (no adductor muscle group yet), and timed or cardio exercises. bw chose to add timed and cardio logging (duration, distance, level; energy estimated from MET values, shown but not added to the daily target) before M2; it is ROADMAP task M1-14, after which the cardio machines and timed holds join the library.

Ticking ahead (2026-11-21, asked by bw during the field week): a check on a set of a later round than the one in progress, in a superset or a standalone exercise, asks before completing it, because it is usually a mis-tap and would end the running rest; cancelling keeps the rest (PR `m1/confirm-tick-ahead`, "Ticking ahead" in `docs/design-system.md`).

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

- Settings → Code security: enable Dependabot alerts and Dependabot security updates.

## Follow-ups (noticed, not in scope yet)

- The per-exercise weight unit is a device setting, so a second device starts in kg. Decide in M2-05 whether it syncs.
- Stepper typing (`src/ui/stepper.tsx`) selects the value on focus, but in WebKit the tap that focused the field may clear that selection, so typed digits are appended ("8" then "5" gives "85"). Check on the iPhone during M1-13 and fix in the stepper if confirmed.
- A day's estimated length (`estimateDayS`) counts a rest after every set of a superset member, although a superset rests only after each round, so a day with supersets is estimated too long.
- Plan days keep the order they were added in; exercises can be reordered, days cannot yet.
- The spacing scale has no 44 px step, so a 44 px tap target comes from padding (`py-12` around 15 px text). Consider a `--tap` size token when a third component needs one.
- `theme-color` and the splash screens follow the system colour scheme, not a theme forced with `data-theme`; revisit if Settings adds a theme switch.
- TypeScript is pinned to 6.0 because `typescript-eslint` 8.72 supports `<6.1`; move to TypeScript 7 once it does.
- `eslint-config-next` bundles plugins whose peer ranges stop at ESLint 9, so `pnpm install` prints a peer warning; lint runs clean. Re-check on each Next upgrade.
- The health response shape is declared in `apps/api`, not as a schema in `packages/shared`; move it there when the web app first consumes an API response.
- `e2e/offline.spec.ts` failed once on iPhone SE in CI (PR `m1/library-legs`, 2026-11-17): after finishing offline, tapping 完成 on the summary left the page at `/workout/summary`; the re-run passed and the diff was catalog data only. If it recurs, measure whether the link is tapped before the page can navigate (L-028).
- The two search fields (library page, exercise picker) repeat the same input markup with different backgrounds. Extract a `SearchField` in `src/ui` if a third one appears (M3-02 frequent foods).
- The dev site and function URLs appear in the dev deploy's public Actions logs (Terraform outputs). Nothing secret; `/api/health` no longer queries the database, and every other API route will require a token (M2-03).
