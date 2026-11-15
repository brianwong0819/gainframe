# Design system

Source of truth for how Gainframe looks and moves. The clickable reference is `docs/design/prototype.html` (also at https://claude.ai/artifact/2zYcubY3aqTLuWLGX3SynR) — open it in a browser and compare before calling any UI task done. When this file and the prototype disagree, this file wins; fix the prototype or ask.

## Principles

1. **Numbers are the hero.** Weights, reps, grams and kcal are big and set in a monospaced numeral font; everything else stays quiet.
2. **One question per screen.** Today: have I eaten enough? Workout: is this set done? Confirm: is this meal right?
3. **One accent colour, with meaning.** Cobalt only for "moving toward the goal". Amber only for "below target", always with text too.
4. **Thumb zone.** Primary actions sit in the lower half of the screen.
5. **Nothing generic.** No component-library default look, no purple gradients, no sparkle icons, no chat bubbles, no heavy shadows, no illustrations. AI output looks like normal data plus a small `AI` source tag.

## Tokens

Defined once in `apps/web/src/styles/tokens.css` as CSS variables. `apps/web/src/styles/globals.css` replaces Tailwind's default theme with these tokens, so only token utilities exist: colours `bg-surface` / `text-ink-2` / `border-line`, spacing `p-16` / `gap-28` (the number is the pixel value), radii `rounded-ctl` / `rounded-group` / `rounded-media` / `rounded-sheet` / `rounded-full`, type `text-title` / `text-section` / `text-body` / `text-label`, numbers `num` (Martian Mono, tabular). A value outside the system has no class. Components use tokens only. `/dev/kitchen-sink` shows every token and preset; it is built for `next dev` and the dev deploy only.

| Token | Light | Dark | Use |
|---|---|---|---|
| `--bg` | `#EEEFEB` | `#0A0B0D` | page ground (chalk / near-black) |
| `--surface` | `#FFFFFF` | `#141619` | raised groups |
| `--sunk` | `#E3E5E0` | `#1D2024` | tracks, steppers |
| `--ink` / `--ink-2` / `--ink-3` | `#0D0F11` / `#575E66` / `#8E949B` | `#F0F1EE` / `#9BA1A9` / `#5E646C` | text levels |
| `--line` | `#DADDD7` | `#25282D` | hairlines |
| `--accent` | `#2340E0` | `#7389FF` | toward-goal only |
| `--short` | `#A85A14` | `#E39A54` | below target only |
| `--glass` | `--bg` at 82% | `--bg` at 80% | the tab bar's ground only (with a backdrop blur); nothing else is translucent |

Type: UI uses the system stack (`-apple-system, "SF Pro Text", "PingFang SC", …`); numbers use **Martian Mono** (self-hosted) with `tabular-nums`. Display 48/300 (the rest countdown only), title 30/650, section 24/650, body 15/400, label 13/500, caption 11/500 (tab bar labels only), input 16/400 (text fields only: iOS Safari zooms the page into a field whose text is smaller than 16 px).

Spacing scale: 4 · 8 · 12 · 16 · 20 · 28 · 40 — nothing else. Radii: control 12, group 20, media/sheet 24–28, pills fully round.

## Motion

Only these. Implemented once in `apps/web/src/ui/motion.ts` (Motion spring configs) and as CSS `linear()` easings generated from the same numbers (see `spring()` in the prototype).

| Name | Stiffness / damping | Use |
|---|---|---|
| `std` | 380 / 30 | pages, sheets, tab pill, number roll |
| `pop` | 520 / 22 | press release, check mark, icons |
| `soft` | 120 / 20 | progress rings, kcal bar, charts |
| `press` | 110 ms, `cubic-bezier(.3,0,.5,1)` | press-down only (scale to 0.96) |
| `fade` | 220 ms | colour / opacity changes |
| `dissolve` | 600 ms, `cubic-bezier(.45,0,.55,1)` | the launch screen's hand-over to the page only |

Rules:
- Animate only `transform` and `opacity` (60 fps on iPhone). Ring/line drawing via `stroke-dashoffset` is the one allowed exception.
- Every pressable thing uses `<Pressable>` (`src/ui/pressable.tsx`): scale 0.96 on press, `pop` on release. Nothing else on plain buttons.
- The CSS `--ease-*` / `--dur-*` curves are sampled from the spring numbers in `motion.ts`; `src/ui/motion.test.ts` fails if the two drift apart.
- Number changes roll digit by digit, 28 ms stagger.
- `prefers-reduced-motion: reduce` → every motion becomes a 200 ms fade; a change of screen never fades (two screens fading overlap their text, L-018); celebrations are off. `<MotionProvider>` (in the root layout) makes Motion skip transform animations, `globals.css` limits CSS transitions to opacity, and `<Pressable>` dims to 0.6 instead of scaling.

## Navigation

Three tabs, Today / Workout / Food, at `/`, `/workout` and `/food` (`src/app/(tabs)`). The tab bar is fixed at the bottom (`--tab-bar-height` above the home indicator) on `--glass`; tab screens pad their content by the same height. The selected tab's pill (`--tab-knob-width`, `--sunk`) slides with `std`; the filled part of its icon pops in with `pop`, and the label colour fades. A tab switch swaps the screen at once, with no page transition: bw tried the rise-in transition on the iPhone and preferred the direct switch (2026-11-09). Only the tab bar animates. Page transitions, if a later screen needs one (a pushed detail view), are proposed to bw first. A page below a tab (`/workout/exercises`, `/workout/session`) keeps that tab selected and is entered and left the same way, at once. **Every page below a tab has a back link at the top (`src/ui/back-link.tsx`) and every sheet a close button**; `e2e/layout.spec.ts` fails when a page listed with a `parent` in `e2e/pages.ts` has no back link to it (L-025). The workout in progress lives at `/workout/session`; leaving it keeps it in progress and the Workout tab offers "Continue workout".

**Sheets.** Forms and details that belong to the current screen open in a bottom sheet (`src/ui/sheet.tsx`): a native modal `<dialog>` (focus trap, Escape, inert page) whose panel rises with `std` over the `--scrim`, which fades with `fade`; with Reduce Motion both only fade. It closes with a close button in its header, a tap on the scrim, Escape, or a downward drag of the header (past 120 px or 600 px/s). On opening it focuses its own panel, never a text field, so the keyboard appears only when the user taps a field (L-019), and with `preventScroll`, so WebKit does not flash the panel into view (L-020); and `html:has(.sheet-dialog[open])` stops the page behind it from scrolling. The dialog has `overflow: clip`: as a scroll container it would scroll to show the rising panel, which then appears at once (L-023); `e2e/sheet.spec.ts` checks every frame of the opening. A sheet whose content scrolls keeps its main action in reach with `.sheet-footer`, which sticks to the bottom and covers the panel's bottom padding. A sheet may swap its content in place (a list, then one item's detail with a back button): keep the list mounted and hidden so its search and scroll survive the way back.

**Muscle map.** `src/features/exercises/muscle-map.tsx` draws one front-and-back body in SVG: the primary muscle in `--accent`, secondary muscles in `--accent-soft`, the rest in `--sunk`. In the exercise form it is also a picker (first tap primary, later taps secondary, a second tap removes). Some regions are about 10 px wide, under the 44 px tap target, so a row of muscle buttons in the same two colours sits below it as the control that always works.

**Active workout.** Each exercise is a card with a set table (set, last time, weight, reps, check), as in the prototype. Unlike the prototype, the steppers are not in every row: at 320 px a row cannot hold two steppers with 44 px targets. The selected set (the first not done, or the one tapped) is edited in a panel that sticks above the tab bar, in the thumb zone, with two full-width steppers (48 px targets) and the complete button. For a bodyweight exercise the weight column is the added load and 0 reads "自重 / BW". Tapping the weight label in the panel (a `kg | lb` pill) switches that exercise between kg and pounds; in pounds every weight of the exercise reads in pounds and the panel shows the kg value beneath, for gyms that label some machines in pounds. Tapping a stepper's number opens the keypad to type it (`src/ui/stepper.tsx`); the numbers roll (`src/ui/rolling-number.tsx`), and the set check pops its disc with `pop` and draws the tick.

**Rest timer.** Completing a set with sets still to do opens the rest sheet (`features/workout/rest-timer.tsx`): a ring that empties with `soft` as the rest runs out, the time left in the display size, −15 / +15 and "开始下一组 / Start next set", which ends the rest. Closing or dragging the sheet down collapses it to a pill centred above the set panel (`.workout-dock`, which keeps both above the tab bar); the pill enters with `pop` and reopens the sheet. When the rest is over the pill turns `--accent`, reads "休息结束 +0:42" and a tap stops the cue and ends the rest. A rest that ended while the app was hidden shows a one-line note that a locked phone gives no alert (ADR-0005).

## Celebrations (three tiers, only at meaningful moments)

| Tier | When | Effect |
|---|---|---|
| Chalk | every completed set | a small puff of chalk around the check, gone in 0.5 s |
| Plates | PR, or an exercise finished | cobalt/ink plate fragments with gravity + "新纪录 / New PR" tag |
| Ripple | protein target hit, workout finished | two rings pulse out from the progress ring, then plates |

Colours come from tokens. Never add a fourth tier or use them on ordinary buttons.

Timing rules (`src/ui/celebration.ts`, one canvas over the page, `celebrationTiming` holds the numbers): a celebration starts at the tapped button at once, since the set panel moves on to the next set. A record adds plates and the "新纪录 / New PR" tag rising from the button (enters with `pop`, holds 1.1 s, fades with `fade`); the record row then shows "新纪录" in its "last time" column. An exercise's last set adds smaller plates without a tag. The rest sheet opens only after the celebration (0.5 s after chalk, 1.2 s after a record), while the rest already counts from the tap. The summary's ripple plays 0.3 s after it appears, only when reached by finishing the workout, never when opened again. Under Reduce Motion nothing is drawn and the rest sheet opens at once.

## Screens defined by the prototype

Today (surplus gauge, protein ring, today's workout, weight 7-day average with target corridor, weekly AI summary) · Workout (set table, steppers, rest sheet that collapses to a pill) · Food + photo confirm (gram steppers, tap-to-correct names with AI alternatives, add oil/sauce, "remember this correction").

## Screen edges

The app runs full screen (`viewport-fit=cover`), under the status bar and the home indicator. Screen content is padded by `--safe-top` + `--space-20` at the top, `--safe-bottom` + `--space-20` at the bottom (plus the tab bar once it exists), and `max(--space-20, inset)` at each side, as in the prototype. iOS 26 and later draw a home-screen web app full screen and blur a band below the status bar (the "scroll pocket") unless an opaque fixed element touches the top edge across most of the width; the root layout's `.status-bar-fill` strip (the status bar's height, `--bg`) is that element and must stay.

The `--safe-*` tokens are the only place that reads `env(safe-area-inset-*)` (a unit test enforces it), so the device tests can replace them with real values.

## Device QA

Desktop browsers and emulators report zero safe-area insets, so they cannot show content hidden under a notch or the Dynamic Island. Three layers cover it:

1. **Device layout tests (CI).** `apps/web/e2e/layout.spec.ts` opens every page on the matrix in `apps/web/e2e/devices.ts` (iPhone SE, 17e, 17, 17 Pro Max in WebKit; Pixel 7 and Galaxy S24 in Chromium), light and dark, with each device's real insets injected through the `--safe-*` tokens. A test fails when the page scrolls sideways or a text, image or control element sits inside an inset (decorative `aria-hidden` layers are allowed there). Screenshots, with the insets shaded, are in the `device-layout-report` artifact of the CI run. Locally: `pnpm --filter web build` with `GAINFRAME_DEV_PAGES=1`, then `pnpm test:e2e`. A new page is added to the list at the top of the spec. To save Actions minutes, a pull request runs every e2e spec on iPhone SE and Galaxy S24 only (one WebKit and one Chromium device, the smallest screens), `main` runs the full matrix after the merge, and a pull request that changes only `docs/` or Markdown skips the tests (the job still reports, so the required check passes). A change that depends on a particular screen size, such as safe areas or a sticky panel, is run locally on the full matrix before pushing.
2. **Android in Chrome DevTools (manual, when a screen changes).** Device toolbar (Ctrl+Shift+M) at 360 and 412 px wide, light and dark. No install needed.
3. **The iPhone (manual, before a UI task is done).** The installed app from the home screen, light and dark, Reduce Motion on and off. This is the only check of the real status bar, scroll blur and keyboard.

Not used: pixel-diff baselines (screens still change every task; revisit after M1), paid device clouds, and the Android Studio emulator (about 10 GB; Chrome covers layout).

## Launch

The iOS splash screen shows the mark centred at 42% of the screen width (`src/pwa/mark.ts`). The installed app's static HTML opens on the same mark at the same place (`<LaunchScreen>`), which holds for a moment, lifts with `soft` and dissolves into the page with `dissolve` (the backdrop fades while the mark grows slightly; a spring fades fastest at the start and read as a cut) once the page is interactive, about 1.6 s in all, so the splash continues into the app instead of cutting to it. Under Reduce Motion only the fade remains. Browser tabs never show it.

## Learning from great UI (encouraged)

Claude may — and should — study strong interfaces and effects before building a screen, and bring in what fits. Good places to look: Motion's examples, Radix primitives, Vaul/Sonner (Emil Kowalski), Rauno Freiberg's interaction notes, React Bits, Magic UI, Aceternity UI, Apple's Human Interface Guidelines, Mobbin and the best fitness/finance apps for patterns.

Rules for bringing something in:
1. **It must fit this file.** Rebuild it with our tokens and the three springs. If it needs a new colour, a fourth celebration tier, a gradient/glow, or would make the app look like the source site, don't use it.
2. **Check the licence.** MIT/Apache/ISC code may be adapted; record the source in `docs/design/credits.md` (what, URL, licence). Paid templates, "all rights reserved" code, or anything without a licence: inspiration only — reimplement from scratch, never copy.
3. **Prefer re-implementing over installing.** A small effect is usually 30–80 lines on top of Motion. A new package still needs bw's OK (CLAUDE.md).
4. **Stay in the task.** If it belongs to the current task's screen, add it and say so in the PR with a before/after recording. If it belongs elsewhere, put it in STATUS "Follow-ups" with the link.
5. **Performance and access.** transform/opacity only, 60 fps on iPhone, reduced-motion fallback, no layout shift.
6. **Record good finds.** Patterns we adopt get a line in "Adopted patterns" below so future screens reuse them instead of inventing new ones.

### Adopted patterns

_Format: pattern — where we use it — source — credits entry._

- Swipe a row left to reveal one action, a tap on an open row closes it — history set rows (`src/ui/swipe-row.tsx`) — iOS list swipe actions (Apple Human Interface Guidelines), reimplemented without code from the source — none needed.

## Checklist before a UI PR

- [ ] Only tokens; no raw hex/px/durations (`grep` the diff).
- [ ] Light and dark screenshots at 390×844; the Device layout job passes.
- [ ] Reduced-motion checked.
- [ ] Every string from the i18n catalogue; zh and en both present.
- [ ] Tap targets ≥ 44 px; focus visible for keyboard users (the `--accent` ring shows only while `<html data-input="keyboard">`, L-021); screen-reader labels.
- [ ] Compared side by side with the prototype.
