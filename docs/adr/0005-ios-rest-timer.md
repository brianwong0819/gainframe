# ADR-0005: iOS rest timer limits and the three-layer fallback

- Status: accepted
- Date: 2026-11-07

## Context

The rest timer is the feature used most during a workout, and Gainframe is a home-screen web app on iOS, not a native app. M0-13 measured what iOS allows with a dev-only test page (`/dev/rest-timer`): a countdown derived from a stored end time, a screen wake lock, and a three-beep cue scheduled on the Web Audio clock inside the start tap. bw ran it from the home-screen app on an iPhone on 2026-11-07. Findings from the page's event log and bw's notes:

| Situation | Observed |
|---|---|
| Screen on, app in front | The wake lock held (the screen did not auto-lock); the countdown ended 1 ms after its deadline; the cue played on time. |
| Phone locked or another app opened | Within 3 ms the wake lock was released and the page hidden; about 0.5 s later the audio context went `interrupted`. JavaScript and the audio clock both stopped: one run's end was noticed 42 s late, the audio clock fell 60–70 s behind the wall clock, and no cue played while hidden. |
| Back in the app | The audio context returned to `running` within 50 ms; the countdown showed the correct remaining time at once, because it is computed from the end time. A cue scheduled on the frozen audio clock would play late, after the remaining audio time elapses. |
| Silent mode | bw heard the cue only with the ringer on. Which audio session type, if any, overrides the switch was not isolated. |
| Cue | Three 150 ms beeps are too short to notice in a gym. |
| Phone call | Not tested; locking already produced the same `interrupted` state a call does. |

Live Activities and the Dynamic Island require ActivityKit in a native app ([Apple: ActivityKit](https://developer.apple.com/documentation/activitykit)); a web app cannot start one. Home-screen web apps on iOS 16.4+ can receive Web Push after the user grants permission from a tap ([WebKit: Web Push for Web Apps on iOS and iPadOS](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/)), which shows on the lock screen like any notification. The Notification Triggers API (local scheduled notifications) is not available in Safari.

## Options considered

1. **Rely on the page alone** (wake lock + scheduled audio). Works while the screen is on; silent the moment the phone locks or another app opens. Not enough on its own.
2. **Keep the page alive with background audio** (a silent looping track or Media Session "now playing"). Fragile, stops or ducks the user's music, drains the battery, and is the kind of workaround iOS updates break. Rejected.
3. **Hand the countdown to the native Clock timer** through a user-installed Shortcut (`shortcuts://run-shortcut`), which shows in the Dynamic Island. Each rest would open the Shortcuts app briefly and requires a setup step per device. Kept as a possible later experiment, not a plan.
4. **Three layers**: the page while visible, a correct state on return, and a server-sent Web Push at the end of the rest while hidden.

## Decision

Option 4.

1. **Visible:** wake lock on while a workout is active; the countdown is always `endAt - now`; at the end, a cue that repeats until the user taps to dismiss it (bw's request), long and loud enough to notice, plus an on-screen state change.
2. **Return from hidden:** on `visibilitychange` to visible, recompute from `endAt`, cancel any cue still scheduled on the audio clock, and if the rest is over show the overdue state ("rest over 0:42 ago") and play the cue once. Re-acquire the wake lock.
3. **Hidden:** M5-02's Web Push, scheduled by the server for `endAt` when a set is completed and cancelled when rest is skipped. It is the only layer that reaches the lock screen; it cannot show a live countdown.

## Consequences

- M1-06 implements layers 1 and 2 with no server; the in-app timer is reliable as long as the app is in front, which is how it is used between sets.
- Until M5-02 ships, a locked phone gets no alert at rest end. The UI should make this clear the first time the user locks with a rest running (a one-line hint, not a modal).
- Silent mode: test the `playback` audio session type against the ringer switch in M1-06, and whether it pauses the user's music; prefer a type that mixes with music if both cannot be had.
- A countdown in the Dynamic Island needs a native app; revisit only if Gainframe ever ships one (see the planned PWA-over-native ADR in M0-14).
