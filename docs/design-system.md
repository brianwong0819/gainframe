# Design system

Source of truth for how Gainframe looks and moves. The clickable reference is `docs/design/prototype.html` (also at https://claude.ai/artifact/2zYcubY3aqTLuWLGX3SynR) — open it in a browser and compare before calling any UI task done. When this file and the prototype disagree, this file wins; fix the prototype or ask.

## Principles

1. **Numbers are the hero.** Weights, reps, grams and kcal are big and set in a monospaced numeral font; everything else stays quiet.
2. **One question per screen.** Today: have I eaten enough? Workout: is this set done? Confirm: is this meal right?
3. **One accent colour, with meaning.** Cobalt only for "moving toward the goal". Amber only for "below target", always with text too.
4. **Thumb zone.** Primary actions sit in the lower half of the screen.
5. **Nothing generic.** No component-library default look, no purple gradients, no sparkle icons, no chat bubbles, no heavy shadows, no illustrations. AI output looks like normal data plus a small `AI` source tag.

## Usability

A screen that looks finished but is slow or unclear to use is not done. These rules apply to every screen and sheet, and the plan for a UI task states how it meets the first one.

1. **Name the main job and count the taps.** Each screen has one job the user does most often (log a set, log a usual meal). The plan names it and the number of taps it takes; it is reachable with one thumb, and a job done daily takes no more than two taps from its tab.
2. **Prefill, then confirm.** Offer the most likely value (last weight, the meal for this time of day, the portion logged last time) so the user confirms instead of typing. Typing is the fallback, never the only way.
3. **Every action answers.** A tap changes something visible at once (press scale, a number that rolls, a row that appears). An action that removes data asks twice or offers Undo.
4. **Every state is designed.** Empty, loading, error and offline versions of a screen are part of its design. Each says in one sentence what happened and offers the next step as a button; none is a dead end.
5. **Plain words.** Labels use the words a gym-goer would say, with units on every number. No internal terms (sync, outbox, payload, model) outside Diagnostics; an estimate is called an estimate.
6. **Never lose input.** Leaving a screen, closing a sheet by accident or relaunching the app keeps what was entered, or says clearly that it was discarded.
7. **A way back everywhere.** Every page below a tab has a back link and every sheet a close button (see Navigation).

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
| `--logo-disc` | `#FFFFFF` | `#FFFFFF` | the disc under a third-party mark that its brand rules require on white (Google) |
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

Three tabs, Today / Workout / Food, at `/`, `/workout` and `/food` (`src/app/(tabs)`). The tab bar is fixed at the bottom (`--tab-bar-height` above the home indicator) on `--glass`; tab screens pad their content by the same height. While a text field on a screen has focus the tab bar is hidden and a `.screen-dock` moves down to the keyboard, because the keyboard covers the home indicator and the bar would take the room the results need (L-045). The selected tab's pill (`--tab-knob-width`, `--sunk`) slides with `std`; the filled part of its icon pops in with `pop`, and the label colour fades. A tab switch swaps the screen at once, with no page transition: bw tried the rise-in transition on the iPhone and preferred the direct switch (2026-11-09). Only the tab bar animates. Page transitions, if a later screen needs one (a pushed detail view), are proposed to bw first. A page below a tab (`/workout/exercises`, `/workout/session`) keeps that tab selected and is entered and left the same way, at once. **Every page below a tab has a back link at the top (`src/ui/back-link.tsx`) and every sheet a close button**; `e2e/layout.spec.ts` fails when a page listed with a `parent` in `e2e/pages.ts` has no back link to it (L-025). The workout in progress lives at `/workout/session`; leaving it keeps it in progress and the Workout tab offers "Continue workout".

**Sheets.** Forms and details that belong to the current screen open in a bottom sheet (`src/ui/sheet.tsx`): a native modal `<dialog>` (focus trap, Escape, inert page) whose panel rises with `std` over the `--scrim`, which fades with `fade`; with Reduce Motion both only fade. It closes with a close button in its header, a tap on the scrim, Escape, or a downward drag of the header (past 120 px or 600 px/s). On opening it focuses its own panel, never a text field, so the keyboard appears only when the user taps a field (L-019), and with `preventScroll`, so WebKit does not flash the panel into view (L-020); and `html:has(.sheet-dialog[open])` stops the page behind it from scrolling. The dialog has `overflow: clip`: as a scroll container it would scroll to show the rising panel, which then appears at once (L-023); `e2e/sheet.spec.ts` checks every frame of the opening. A sheet whose content scrolls keeps its main action in reach with `.sheet-footer`, which sticks to the bottom and covers the panel's bottom padding. A sheet may swap its content in place (a list, then one item's detail with a back button): keep the list mounted and hidden so its search and scroll survive the way back. iOS lays the keyboard over the page without shrinking the layout viewport, so the dialog follows the visual viewport while it is open and its panel sits on the keyboard (L-035); a sheet whose list a search shortens (the exercise picker) passes `fullHeight`, so its top does not jump while typing. `e2e/sheet.spec.ts` stands in for the keyboard with a shorter visual viewport. The exercise picker (plan day and workout) offers "新建“…” / Create “…”" under any search, as the library does; it opens the library's form named after the search in place, and the saved exercise is added at once.

**Muscle map.** `src/features/exercises/muscle-map.tsx` draws one front-and-back body in SVG: the primary muscle in `--accent`, secondary muscles in `--accent-soft`, the rest in `--sunk`. In the exercise form it is also a picker (first tap primary, later taps secondary, a second tap removes). Some regions are about 10 px wide, under the 44 px tap target, so a row of muscle buttons in the same two colours sits below it as the control that always works.

**Active workout.** The header (`features/workout/session-header.tsx`) names the plan day being done ("Workout" for one started empty) with its plan beneath, shows the time since the start as a running clock, one segment per set filled as sets are completed with the count beside it, and the finish button at the top right, so finishing never needs a scroll to the end of the page. Each exercise is a card with a set table (set, last time, weight, reps, check), as in the prototype. Unlike the prototype, the steppers are not in every row: at 320 px a row cannot hold two steppers with 44 px targets. The selected set (the first not done, or the one tapped) is edited in a panel that sticks above the tab bar, in the thumb zone, with two full-width steppers (48 px targets) and the complete button, which spells out what it will log ("完成 · 62.5 kg × 8"; its accessible name stays "Complete set n"). Once every set is done the panel gives way to a finish prompt in the same place (`.dock-panel`): the set count, the volume, the records, and the finish button. Completing a set of an exercise never done before copies its weight to the later sets of that exercise that have none yet (`setsTakingWeight` in `packages/shared`), so a plan day's first time does not ask for the same weight three times; a set that has a weight, from last time or typed, is never changed. For a bodyweight exercise the weight column is the added load and 0 reads "自重 / BW". Tapping the weight label in the panel (the two units under the word, the current one in ink) switches that exercise between kg and pounds; in pounds every weight of the exercise reads in pounds and the panel shows the kg value beneath, for gyms that label some machines in pounds. Tapping a stepper's number opens the keypad to type it (`src/ui/stepper.tsx`); the numbers roll (`src/ui/rolling-number.tsx`), and the set check pops its disc with `pop` and draws the tick.

**Ticking ahead.** A check tapped on a set of a later round than the one in progress (a superset's round, or a standalone exercise's earlier set still to do; `earlierRoundToDo` in `packages/shared`) opens a sheet first: "还没轮到这一组", which round or set is still open, and, while a rest runs, that completing it ends the rest. "取消" is the prominent button and writes nothing, so the rest carries on; "仍然完成" completes the set. The set the panel shows never asks, because the user chose it.

**Correcting a done set.** A tap on a ticked set's row opens its sheet, titled with the exercise and the set ("坐姿绳索划船 · 组 1"), with the same weight and reps steppers as the set panel above its kind, RPE and delete; every tap is stored at once and records recompute from the stored sets. A corrected weight also moves the later sets of that exercise that are not done and still at the old weight (`setsFollowingWeight` in `packages/shared`), so a set ticked at the wrong weight does not leave the rest of the exercise prefilled with it; a set with any other weight is left alone.

**Workout tab.** From the top: the workout in progress, if any (`features/workout/continue-card.tsx`: an `--accent-soft` outline, the day's name, the running clock, the next set, the set segments and "Continue"); this week (`features/workout/week-card.tsx`: Monday to Sunday with trained days ticked in `--accent` and today outlined, and the week's workouts, sets and volume), shown once a workout has been finished; the plan's next day with a rough length (45 s a set plus its rest, to five minutes) and what the day came to last time; then plans, history and the library as three rows of one card, so the screen leads with figures instead of navigation.

**Exercise library.** A row names the exercise with its muscle, equipment and default rest on the second line; at the right, once the user has done the exercise, their best set ("Best 85 kg × 5": the heaviest working set, most reps first; `bestSets` in `packages/shared`). After the first completed set a "练过 / Done" chip leads the muscle chips and narrows the list to exercises with a best set; it combines with the muscle chip and the search.

**Workout summary.** One card of figures led by volume in the title size with its unit small; beside it, when the workout's plan day has been done before, the change against that last time ("+6.3% vs last Push": an `--accent` tag when volume rose, plain `--ink-2` text when it did not, absent for a first time and for a workout started empty). Duration, sets and records follow in one row. Each exercise card has its top set at the right, its sets and volume below with the change of the top set's weight against last time, then its records. The comparison is `compareSummaries` in `packages/shared`; history opens the same view with the sets listed.

**History.** A heading per month with what the month added up to at the right (workouts, sets, volume; `totalWorkouts` in `packages/shared`). A card is four lines: the day's name with the record tag, the plan and time, the main muscle groups as neutral `--sunk` tags followed by the exercise names on one truncated line, and duration, sets and volume as one line. Only the record tag uses `--accent`, so a screen of cards has one thing that stands out.

**Plan editor.** A name edited in place carries a small pencil (`features/plans/name-field.tsx`), so the plan's and each day's name read as editable. Under a day's name: its exercise count and rough length, the same estimate the Workout tab shows. Each exercise row states the rest it will actually get (the exercise's default when the plan sets none). Deleting a day sits behind the day's ⋯ menu and still takes a second tap, so no destructive button stands beside "Add exercise".

**Today (until M3).** The date under the title, then the same card the Workout tab leads with (`NextWorkout`: continue, start the plan's next day, or start an empty workout), this week, and the latest record of up to three exercises. Before the first finished workout a sentence says what will appear here. The food day card of "Food logging" goes above these when M3 lands.

**Rest timer.** Completing a set with sets still to do opens the rest sheet (`features/workout/rest-timer.tsx`): a ring that empties with `soft` as the rest runs out, the time left in the display size, the set that comes next on a `--sunk` row (exercise, "set 2/3", weight × reps), so the plates can be changed during the rest, −15 / +15 and "开始下一组 / Start next set", which ends the rest. Closing or dragging the sheet down collapses it to a pill centred above the set panel (`.screen-dock`, which keeps both above the tab bar); the pill enters with `pop` and reopens the sheet. When the rest is over the pill turns `--accent`, reads "休息结束 +0:42" and a tap stops the cue and ends the rest. A rest that ended while the app was hidden shows a one-line note that a locked phone gives no alert (ADR-0005).

## Food logging

Designed ahead of M3 (2026-11-16); the reference is the design canvas at https://claude.ai/artifact/Ly4iif3XkkrvymEdLj4TX4 (ten artboards: the seven screens below and three Today card options, of which bw chose C). Where the canvas and the older prototype disagree on food screens, the canvas wins. Sample data uses local dishes (chicken rice, mixed rice), which is also what the eval set should contain.

**The question each screen answers.** Food tab: how much protein is still missing today? Confirm: is this meal right? Protein is always shown before energy, because protein is the number a user who is trying to gain acts on meal by meal; the energy surplus is judged over the day.

**Food tab (`/food`).** Top to bottom:

1. Header with the date and previous / next day buttons (next is disabled on today).
2. The day card: "还差 42 g / 42 g to go" in the display number, eaten / target beside the label (a button that opens the daily targets sheet: protein and energy steppers, saved on each change; above them a "帮我算 / Work it out for me" row opens the calculator in the same sheet: sex, birth year, height, weight, activity level and phase, with the result and how it was reached shown live, and "用这个目标 / Use these targets" fills the steppers and stores the weight as the first weigh-in; without targets the card shows what was eaten and a "设定每日目标 / Set daily targets" button instead; bw chose the Food tab over Settings on 2026-11-23), a bar with one `--accent` segment per meal on a `--sunk` track, then energy eaten / target on one line. When the target is met the number is the amount eaten in `--accent` with "今天达标 / Target met". `--short` is not used during the day; a gap is not a failure until the day is over.
3. Three entry points in one row, in the thumb zone: Photo (the only `--accent` button on the screen), Frequent and Manual.
4. Frequent foods as one row of pills that scrolls sideways; a tap logs one portion at once (meal type from the time of day) and shows the confirmation toast with Undo. This is the path that meets the M3-02 target of 10 seconds.
5. Today's meals, newest first: time and meal type, a title (the first item, or the dish name the model gave), the item names on one line, energy and protein (`--accent`) at the right, and the `AI` source tag on estimated meals. A tap opens the meal in the confirm screen for editing; a swipe left deletes it (`src/ui/swipe-row.tsx`). Until the confirm screen exists (M3-06) a tap opens the meal's sheet: meal type, then per item the grams (a stepper; protein and energy scale with it) and the protein and energy as fields the user can type over, e.g. from the dish's label (bw, 2026-11-23); a corrected figure is kept, and later gram changes scale from it.

**Photo flow.** The Photo button opens the system picker (camera or library) from a file input; no custom camera. The chosen photo appears at once on the estimating screen with a scan line (one `--accent` line moving with `transform`; hidden under Reduce Motion), skeleton rows where the result will be, the meal type control already usable, a line saying the wait is usually 3 to 8 seconds and that the photo is deleted after 30 days, and "不等了，手动输入 / Enter it by hand" at the bottom. The result replaces the skeletons in place; the screen does not change.

**Confirm screen.** Back link, title, "重拍 / Retake". The photo (cropped to a band, with the `AI` tag and the item count), the meal type segmented control, then protein and energy totals in the large number size, and one line: "记入后今天蛋白质 142 / 140 g，达标" (or "还差 n g"), so the effect on the day is known before saving. Items are one group:

- Each row: the name as a button with a pencil mark, protein and energy for the row, and a gram stepper (`src/ui/stepper.tsx`, steps of 10 g, typing allowed). A row that used a remembered correction says so in one `--ink-2` line.
- "油和酱 / Oil and sauce" is always the last row, with a three-way control (少 / 正常 / 多) and the energy it adds. The model cannot see oil; asking is more honest than guessing silently, and it is the largest error in cooked dishes.
- "+ 添加食物 / Add food" opens the manual screen.

The save button ("记入晚餐 / Log dinner") is docked at the bottom. Saving returns to the Food tab, the new row enters with `std`, the day card's numbers roll, and a toast offers Undo; reaching the protein target plays the existing Ripple tier once.

**Correcting a name.** A tap on a name opens a sheet: what the model saw, its alternative names as pills with their protein for the same weight (the first tap target, since the right answer is usually among them), a text field for anything else, the "记住这次纠正 / Remember this correction" switch (on by default) and Save. The sheet has the standard close button.

**Manual screen (`/food/add`).** A search field over the user's own foods and the bundled food table: a search lists "你的食物 / Your foods" first, then up to 20 "食物库 / Food table" matches, each a typical serving with the same plus and minus (a food table serving chosen stays listed under "食物库" once the search is cleared). A row "写一句话来记 / Describe it in a sentence" with the `AI` tag, then Frequent and Recent lists. Each row has a plus button; after the first tap it shows a minus button and the count, so several foods and several portions are chosen before saving. The dock holds "新建食物 / New food" and the save button, which reads "先选食物" until something is chosen and then names the meal, the item count and the protein. A new food is a sheet with four fields (name, grams per portion, protein and energy per portion) and the hint to copy them from the nutrition label once; it is saved to the user's foods (M3-12) and added to the meal. Without a search, "我的食物 / My foods" lists the user's saved foods and edited table entries that are not already under Frequent or Recent.

**Editing a food (M3-12).** A tap on any food's name on the manual screen opens "编辑食物 / Edit food": a line saying where the figures come from (a table source, the user's edit of one, or the user's own food), the name, the servings (a name such as "1 勺" and grams; the first is the one the plus button adds; up to six, "加一个份量 / Add a serving"), protein and energy for the first serving as a label prints them, the figures per 100 g they work out to, and the line "已经记下的餐不会变 / Meals already logged stay as they are". Save is the primary button. An edited table entry carries the "已修改 / Edited" tag in lists and offers "恢复默认数据 / Restore the original figures"; an own food offers "删除这个食物 / Delete this food"; both ask twice (`ConfirmButton`). A frequent or recent food named like a saved food keeps the amount last eaten with the saved food's figures. Editing a food that is already chosen for the meal unchooses it, so the meal never logs the old figures. Settings names the food table's sources under "食物营养数据 / Food data", each linked to its site. A sentence is estimated by the same endpoint as a photo and lands on the same confirm screen, without a photo band.

**States.** Each replaces the skeleton rows on the estimating screen, with a title, one sentence and two buttons, in ordinary `--ink` text (none is the user's failure, so none uses `--short`):

| State | Message | Actions |
|---|---|---|
| Offline when the photo is taken | The meal is saved as "待估算 / Waiting for estimate" with the photo kept on the device; it is estimated when the app is next online and then asks for confirmation | Enter by hand |
| Estimate failed or took over 20 s | The photo is kept | Retry, enter by hand |
| No food recognised | Advice on framing and light | Retake, enter by hand |
| Daily cap reached | The count and when it resets | Frequent, enter by hand |

Each failure names its cause (design change at bw's request, 2026-11-23): "AI 服务暂时用不了" when the model cannot be reached (no Retry, since it would not help), "估算太久没回应" and "估算没有完成" with Retry, and for a photo the model cannot count, its reason (no food, too dark, blurry, part of the meal out of frame) with a matching tip and Retake. Each estimated item shows a small `AI` tag with its confidence (把握高 / 中 / 低).

A meal waiting for its estimate counts as zero in the day's totals and says so in its row; it never shows invented numbers.

**Today card (option C).** The Food tab's day card, followed, when protein is short and the user has frequent foods, by "用你常吃的补上 / Fill it with your usual", up to two of the user's frequent foods chosen by a rule to cover the gap with the fewest items, each with its protein, its energy and a plus button that logs it, and a line with their sum. When a workout was finished today the heading names it ("今天练了腿") and carries the "训练联动 / From training" tag. The suggestion is a pure function in `packages/shared/src/domain`; no model call is involved. With no frequent foods yet the card ends after the bar and offers the Photo button instead.

**Wording.** Estimates are called estimates everywhere ("AI 估算"), never "识别结果" or "accurate". No streaks, scores or praise for eating; the only celebration is the protein target.

## Accounts and backup

Designed ahead of M2 (2026-11-17); the reference is the design canvas at https://claude.ai/artifact/SKxZkgdarw9cfk5AffeB7q (a clickable prototype in light and dark, and one artboard per state). bw chose the recommended option of each of the four decisions on 2026-11-17; the rest follows from [ADR-0003](adr/0003-data-model-and-sync.md).

**Wording.** The user-facing word is "备份 / backup", never "同步 / sync", "outbox" or "queue" (Usability rule 5). Diagnostics may use the internal terms. Sample copy: "已备份", "正在备份 3 条改动", "现在离线", "备份没成功", "需要重新登录".

**Signing in is optional.** The app keeps working without an account, as in M1. Three entry points lead to the same sign-in page: the account row that leads Settings, a one-line card at the end of Today once the device holds a finished workout ("12 次训练只存在这台手机", a "登录" button and a dismiss button; dismissed for good), and the first use of a feature that needs the server (the photo estimate in M3), which explains why before sending the user there.

**Sign-in page (`/settings/sign-in`).** Back link to Settings. One card states what is at stake in numbers: the workouts and plans that exist only on this device, and one sentence on what an account changes. The actions sit in the thumb zone: "用 Google 继续 / Continue with Google" (ink-filled, with the Google mark on a white disc, as Google's branding rules require), "用邮箱继续 / Continue with email" (`--sunk`), and the line "不登录也能一直用". No `--accent` on this page: signing in is not progress toward a training goal.

- Google goes straight to Google: the authorize request carries `identity_provider=Google`, which bypasses managed login ([authorize endpoint](https://docs.aws.amazon.com/cognito/latest/developerguide/authorization-endpoint.html)).
- Email opens Cognito's managed login page (chosen over option B), which provides sign-up, email verification and password reset. Its colours and logo are set to the tokens; its layout cannot be changed. Option B, an in-app form, needs three more screens (sign-up, verification code, reset) and puts password handling in our code. A passwordless email code is not proposed: it requires an Amazon SES email configuration ([user pool email settings](https://docs.aws.amazon.com/cognito/latest/developerguide/user-pool-email.html)), a new AWS resource.
- Main job: sign in. Two taps from Today (the card's button, then Google) plus Google's own account chooser.

**First sign-in (M2-06).** After the redirect back, a screen names the account and shows the upload as a number that rolls ("8 / 12 次训练") over a `soft` bar, with "先去用 App / Use the app now": the upload continues in the background and never blocks. When it finishes the screen states what the account now holds (workouts, plans, custom exercises) and one sentence saying later changes are backed up automatically. On a device with nothing local the same screen reports the download instead.

**Backup status (quiet).** One cloud icon beside the settings gear in Today's header, shown only when signed in. It opens the backup sheet.

| State | Icon | Sheet title and sentence | Action |
|---|---|---|---|
| Backed up | cloud with a tick, `--ink-2` | "已备份": changes are backed up automatically | Back up now |
| Backing up | cloud with an arrow, `--ink` | "正在备份 n 条改动": keep using the app | none |
| Offline | cloud with a stroke, `--ink-2`, and the count of waiting changes beside it | "现在离线": n changes are kept on this device and are backed up when a connection returns | none |
| Failed, retrying | cloud with an exclamation mark, `--ink` | "备份没成功": n changes are still on this device; the app retries | Retry now |
| Needs the user (sign-in expired, app too old for the server) | the same, plus a card that leads Today | "需要重新登录" / "需要更新 App" | Sign in again / Update |

The sheet lists the account, the last successful backup and the number of changes waiting. Offline is ordinary at a gym: it never uses `--short`, never interrupts and has no banner. Only a state that needs the user puts a card on Today, outlined in `--ink`. A failure that has been retried for a day is treated as needing the user. Option B, a status line under Today's date, is drawn on the canvas for comparison; it is always visible and nearly always says the same thing.

**Account page (`/settings/account`).** Back link to Settings. The email and the sign-in method; a backup card with the same title, sentence, last backup time and action as the sheet; "退出登录 / Sign out"; and "删除账号和全部记录 / Delete account and all records", which asks twice (`ConfirmButton`) and states that nothing can be restored.

**Sign out.** A sheet with the standard close button. With nothing waiting: the device's records are removed, they are in the account and return on the next sign-in; one button. With changes waiting: the title is the count ("还有 3 条改动没备份"), the sentence names what they are, the main button is "先备份再退出" (dimmed with a line of explanation while offline), and "仍然退出，丢掉 3 条" asks twice. Signing out is never refused, because a refusal while backup is broken leaves no way out (Usability rule 4).

**Clear all data (Diagnostics).** Three versions of the existing card. Signed out: unchanged, with the advice to export first. Signed in with everything backed up: "只清空这台手机", stating what stays in the account and that it is downloaded again. Signed in with changes waiting: the same count, main button and two-tap override as sign out. Diagnostics also shows the outbox size and the last successful sync in the internal terms.

## Progress charts

Designed ahead of M4 (2026-11-17); the reference is the design canvas at https://claude.ai/artifact/RCf9ZXeSkKPwyCNzpLSwvd (thirteen artboards: the entry from Today in two options, the Progress page, its first-days state, the weight, exercise and volume pages, the weigh-in sheet, and dark versions). Where the canvas and the older prototype disagree on charts, the canvas wins. bw chose the recommended option of each choice (2026-11-17): the Progress page below Today, estimated 1RM and working sets as the default measures.

**The question the charts answer.** Am I gaining at the planned rate, and am I getting stronger? Every chart leads with the current figure and what it means in words ("in the target range", "3 weeks without a record"); the drawing supports the sentence, not the other way round.

**Where they live (no fourth tab).** `/progress` is a page below Today with the standard back link. It is reached in one tap from the weight card on Today and from a "Progress" row under it. Its four cards (weight, strength, volume, protein) each show the current figure, one line of context and a small chart, and open `/progress/weight`, `/progress/exercise#<id>` and `/progress/volume`. The exercise detail sheet (`ExerciseDetail`) links to the same exercise page. The alternative, a fourth tab, gives one-tap access from anywhere but shrinks every tab and spends a tab on a screen read about once a week.

**Rules for every chart.**

- One y-axis, three hairline grid lines with their values at the right, dates beneath; grid lines are solid and `--line`.
- The data line is `--ink`, 2 px. `--accent` marks only what moves toward the goal: the target range (`--accent-wash`), the latest point when it is on target, records, the week in progress, a muscle group that reached the weekly guideline. `--short` appears only with words beside it (too slow, no record for 3 weeks). Text is never coloured outside a tag.
- Two or more series get a one-line legend under the chart. A list under each chart repeats its figures, so nothing is readable only by touching the chart.
- Reading a point: a horizontal drag (or a tap) moves a hairline that snaps to the nearest point, and the figures in the card header change to that point; there is no floating tooltip, which a thumb would cover. The chart area sets `touch-action: pan-y`, so the page still scrolls vertically. Lifting the finger returns the header to the latest figure. On bar charts a tap selects a bar and the selection stays.
- Motion: the line draws once with `soft` (`stroke-dashoffset`) when its card first appears; a change of range or measure fades with `fade`; header numbers roll; the hairline follows the finger with no spring. Under Reduce Motion nothing draws progressively.
- Charts read from Dexie like every screen, so there is no loading or offline state. The states to design are "not enough data yet" (below).

**Weight (`/progress/weight`).** A range control (4 weeks, 12 weeks, all), then one card: the 7-day average as the large number, the weekly rate with the target rate beside it, and a tag ("在目标范围 / On target" in `--accent`, "偏慢 / Too slow" in `--short`, "偏快 / Too fast" as plain text). The chart draws each weigh-in as a small `--ink-3` dot, the 7-day average as the line, and the target range as a wedge from the average at the start of the visible range, widening at the minimum and maximum target rates. Below it: one card that compares the last two weeks with the food log ("average surplus +310 kcal a day, protein target met 11 of 14 days"), which names the likely cause when the rate is too slow and links to the food history; the weekly averages as a list; and, with two scans or more, the change in weight, fat-free mass and fat mass between them (M4-02; never a daily composition line). "记今天体重 / Log today's weight" is docked at the bottom.

**Weigh-in sheet.** Opened from the weight card on Today or the weight page: a stepper in steps of 0.1 kg prefilled with the last weigh-in, a row that opens the optional body-fat and muscle-mass fields, and a save button that names the value ("记下 62.4 kg"). Logging the day's weight takes two taps from Today.

**Exercise (`/progress/exercise#<id>`).** A control switches between estimated 1RM (the default: it rises when reps go up at the same weight, which is how most progress happens) and the heaviest set. Each workout contributes its best set as one point, placed by date; a record is a filled `--accent` point, other workouts are hollow. The header shows the latest value, the set it comes from ("70 kg × 6") and the change over the range. For a bodyweight exercise the measure is the most reps. When the plateau rule (M5-04) holds, the span since the last record is shaded `--sunk`, the tag reads "3 周没涨 / No record for 3 weeks", and a card lists what happened in the same span: the best set, the change in body weight against the target rate, the average surplus and the days the protein target was met. The model's suggestion (M5-05) follows in the same card as ordinary text with the `AI` tag. Below: heaviest weight, most reps and workout count, then the recent workouts as a list.

**Volume (`/progress/volume`).** One bar per week for twelve weeks, Monday to Sunday; the week in progress is `--accent` and says that it is not over; a hairline marks the average of the last eight full weeks. The measure is the number of working sets (the default) or volume in kg: sets per week is the figure a lifter can act on, while kg is dominated by leg exercises. A tap on a bar selects that week, and the card below shows its sets per muscle group as horizontal bars against a vertical line at ten sets, `--accent` once a group reaches it. A set counts toward the exercise's primary muscle only; warm-up sets are not counted.

**Protein on the Progress page.** The last fourteen days as columns against the target line, `--accent` on the days that met it, with the count ("9 of 14 days") as the large number and the average daily surplus beneath. Its detail page is designed with M4-07.

**Not enough data.** Each card of the Progress page has its own first-days version instead of an empty chart: weight shows the dots logged so far and how many more days the 7-day average needs, strength says that an exercise needs two workouts, volume shows the first week's bar, protein offers to log a meal. Each has one button to the screen that produces the data.

**Numbers behind the drawings.** The target range uses 0.25% to 0.5% of body weight a week (Iraki et al. 2019, off-season recommendations for bodybuilders), and the guideline of ten weekly sets per muscle group comes from Schoenfeld, Ogborn and Krieger 2017 (dose-response meta-analysis). Both are checked against the sources when implemented and live in config with the other thresholds; the functions that compute the range, the weekly sets per muscle and each workout's best set are pure functions in `packages/shared/src/domain`.

## Celebrations (three tiers, only at meaningful moments)

| Tier | When | Effect |
|---|---|---|
| Chalk | every completed set | a small puff of chalk around the check, gone in 0.5 s |
| Plates | PR, or an exercise finished | cobalt/ink plate fragments with gravity + "新纪录 / New PR" tag |
| Ripple | protein target hit, workout finished | two rings pulse out from the progress ring, then plates |

Colours come from tokens. Never add a fourth tier or use them on ordinary buttons.

Timing rules (`src/ui/celebration.ts`, one canvas over the page, `celebrationTiming` holds the numbers): a celebration starts at the tapped button at once, since the set panel moves on to the next set. A record adds plates and the "新纪录 / New PR" tag rising from the button (enters with `pop`, holds 1.1 s, fades with `fade`); the record row then shows "新纪录" in its "last time" column. An exercise's last set adds smaller plates without a tag. The rest sheet opens only after the celebration (0.5 s after chalk, 1.2 s after a record), while the rest already counts from the tap. The summary's ripple plays 0.3 s after it appears, only when reached by finishing the workout, never when opened again. Under Reduce Motion nothing is drawn and the rest sheet opens at once.

## Screens defined by the prototype

Today (surplus gauge, today's workout, weight 7-day average with target corridor, weekly AI summary) · Workout (set table, steppers, rest sheet that collapses to a pill). The prototype's protein ring and food screens are superseded by "Food logging" above.

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

- [ ] Usability: the main job and its tap count are stated in the PR; empty, loading, error and offline states are shown; no input is lost on leaving.
- [ ] Only tokens; no raw hex/px/durations (`grep` the diff).
- [ ] Light and dark screenshots at 390×844; the Device layout job passes.
- [ ] Reduced-motion checked.
- [ ] Every string from the i18n catalogue; zh and en both present.
- [ ] Tap targets ≥ 44 px; focus visible for keyboard users (the `--accent` ring shows only while `<html data-input="keyboard">`, L-021); screen-reader labels.
- [ ] Compared side by side with the prototype.
