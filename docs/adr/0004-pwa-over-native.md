# ADR-0004: Ship a progressive web app, not a native iOS app

- Status: accepted
- Date: 2026-11-08

## Context

The owner trains with an iPhone and wants Gainframe to feel like an app on it: home-screen icon, full screen, offline. The project is also a portfolio for web and cloud roles, not mobile roles. The owner develops on Windows and has no Mac.

Apple's constraints for a native app ([Expo: Apple Developer Program explained](https://expo.dev/blog/apple-developer-program-explained-free-vs-paid)): a free Apple account can sign builds only through Xcode on a Mac, for at most three of the owner's own devices, and each build stops opening seven days after it is made. TestFlight, App Store distribution, remote push and cloud signing without a Mac require the Apple Developer Program at USD 99 a year.

## Options considered

1. **Native Swift app.** Best platform integration (Live Activities, HealthKit, reliable timers). Needs a Mac and the paid program, and a second codebase for any web demo. Not possible on the owner's hardware.
2. **React Native / Expo.** One TypeScript codebase; Expo's cloud builds avoid the Mac, but installing on the iPhone still needs the paid program. Reviewers would need TestFlight access to try it.
3. **Capacitor wrapper around the web app.** Reuses the web code and adds native plugins; the same signing and cost problem as option 2.
4. **Progressive web app** (Next.js static export, service worker, home-screen install). Free, deploys with the rest of the stack, opens from a link for any reviewer, and exercises the web skills the portfolio targets. Limited by what iOS allows web apps.

## Decision

Option 4. Gainframe is a PWA installed from Safari to the home screen. A native shell is not planned.

## Consequences

- iOS limits apply and are designed around: background JavaScript is suspended, so the rest timer uses three layers ([ADR-0005](0005-ios-rest-timer.md)); Web Push works only for a home-screen install after a user gesture (iOS 16.4+, M5-01); no Live Activities or Dynamic Island.
- Storage: WebKit's seven-day cap on script-writable storage counts days of use per home-screen app, and WebKit does not expect a home-screen app's own data to be deleted ([WebKit: Full Third-Party Cookie Blocking and More](https://webkit.org/blog/10218/full-third-party-cookie-blocking-and-more/)). Data in a Safari tab has no such guarantee, so the app asks for persistent storage (M1-02), offers a JSON export (M1-11), and from M2 the server holds a copy.
- No HealthKit. Apple Health data, planned for version 2, has to arrive through an iOS Shortcut or a file export, not a direct API.
- No App Store presence; reviewers try the app from a URL on any phone or laptop (M4-05, M7-01).
- Revisit if the owner gets a Mac and the Developer Program, or if a native-only feature (Live Activities, HealthKit) becomes core. The cheapest path then is a Capacitor shell around the same static export, so no web code is thrown away.
