# Status

The handover note between sessions: where the project is now, what waits on bw, and what was noticed but not done. It is not a changelog. What each task built is in its PR and its ROADMAP entry; where code lives is in `docs/architecture.md`. Keep this file under 100 lines: replace the "Now" section at the end of each task instead of appending to it.

- **Milestone:** M1 Workout logging (code complete)
- **Current task:** M1-13 Field week (bw logs every session for a week)
- **Last updated:** 2026-11-16

## Now

M0 and M1-01 to M1-12 are merged. The app runs offline on the device only: exercise library, plans, workouts with rest timer, supersets, summary and records, history with editing, Settings with Diagnostics and a JSON export. Nothing syncs yet; every write also queues an outbox entry for M2.

The M1 review and retro (2026-11-16, PRs `m1/review` and `m1/retro`) found no data-loss or security defect in the code. Changes: the "ask twice" button is one shared `ConfirmButton` (plan editor and past workout), the device time zone is read in one place (`src/i18n/time-zone.ts`), the data model in `docs/architecture.md` lists the columns M1 added, this file was cut from a changelog to the current state, and lessons L-001 to L-033 were grouped and promoted (retro in `docs/LESSONS.md`).

Next: M1-13. Problems found during the week become issues with the copied Diagnostics report; severe ones are fixed that week. Then M2-01.

## Field week checklist (pending iPhone checks)

Checks that earlier PRs left for bw on the iPhone. Each one is part of M1-13; a failure becomes an issue.

- Home-screen install: opens full screen with the splash screen, status bar matches the background, opens in airplane mode.
- Tabs: switching is smooth in light and dark, with Reduce Motion on and off; English shows no Chinese.
- Library: search, muscle filters, new and edit sheet with the keyboard up, detail sheet with cues and the muscle map.
- Workout: a set logged one-handed in 5 s or less; the stepper's typed digits replace the value instead of being appended (see Follow-ups).
- Plans: make a plan, start its next day from the Workout tab, finish, see the following day offered; add an exercise from its detail.
- Rest timer: the cue and the blue pill on screen; the overdue rest after locking the phone and coming back.
- Supersets: link two exercises in a workout and in a plan; the rest opens only after the last exercise of each round.
- Finish: the plates and the "新纪录" tag feel right; the rest sheet's wait after a celebration is not annoying.
- History: the swipe to delete does not fight vertical scrolling; editing a past set updates its figures.
- Settings: Diagnostics shows errors and copies a report; the export saves to Files; "A new version is ready" appears after a deploy and updates.

## Blocked on bw

- Settings → Code security: enable Dependabot alerts and Dependabot security updates.

## Follow-ups (noticed, not in scope yet)

- `e2e/sheet.spec.ts` failed once on iPhone 17 Pro Max (WebKit) on #98, whose diff touches no sheet code: the first sampled frame of the exercise sheet was already above the half-viewport bound. Its first-frame sampling may race the opening on a slow runner; look at it if it recurs.
- The per-exercise weight unit is a device setting, so a second device starts in kg. Decide in M2-05 whether it syncs.
- Stepper typing (`src/ui/stepper.tsx`) selects the value on focus, but in WebKit the tap that focused the field may clear that selection, so typed digits are appended ("8" then "5" gives "85"). Check on the iPhone during M1-13 and fix in the stepper if confirmed.
- Plan days keep the order they were added in; exercises can be reordered, days cannot yet.
- The spacing scale has no 44 px step, so a 44 px tap target comes from padding (`py-12` around 15 px text). Consider a `--tap` size token when a third component needs one.
- `theme-color` and the splash screens follow the system colour scheme, not a theme forced with `data-theme`; revisit if Settings adds a theme switch.
- TypeScript is pinned to 6.0 because `typescript-eslint` 8.72 supports `<6.1`; move to TypeScript 7 once it does.
- `eslint-config-next` bundles plugins whose peer ranges stop at ESLint 9, so `pnpm install` prints a peer warning; lint runs clean. Re-check on each Next upgrade.
- The health response shape is declared in `apps/api`, not as a schema in `packages/shared`; move it there when the web app first consumes an API response.
- The two search fields (library page, exercise picker) repeat the same input markup with different backgrounds. Extract a `SearchField` in `src/ui` if a third one appears (M3-02 frequent foods).
- The dev site and function URLs appear in the dev deploy's public Actions logs (Terraform outputs). Nothing secret, but anyone can call `/api/health`, which queries Neon; see the health item in the M1 review.
