# ADR-0007: Sign-in flow in the installed app

- Status: accepted
- Date: 2026-11-22

## Context

Sign-in uses Cognito's managed login and Google through the OAuth 2.0 authorization code flow with PKCE (M2-02). The app is a public client with no server-side session: the browser keeps the PKCE verifier while it is away at the identity provider, then exchanges the code for tokens itself.

Reports from 2026 said an installed iOS web app opens an out-of-scope page in an in-app Safari sheet whose storage is separate from the app's ([iOS PWA notes](https://firt.dev/notes/pwa-ios/)). If the redirect back landed in that sheet, the verifier saved before leaving would be missing and the exchange would fail. The developer page `/dev/sign-in-probe` (M2-02 part b) ran the real flow two ways, and bw ran it in the installed app on the iPhone on 2026-11-22. Its log:

- Full-page navigation: the redirect back loaded the page with `display-mode: standalone` and no opener, found the pending sign-in in `localStorage`, exchanged the code and signed in. The whole round trip stayed inside the installed app.
- `window.open`: the new window had an opener and shared storage, and also signed in; with managed login's session cookie already set, it finished in under a second without a visible window.

## Options considered

1. **Full-page redirect.** `location.assign` to the authorize URL; the redirect URI is an app page that finishes the exchange. One window, no messaging; the app's state is gone during the trip, so the page restores what matters from storage.
2. **Popup with `window.open` and `BroadcastChannel`.** Keeps the app's page alive, but the popup must open inside the tap, and on iOS it behaved as a second window inside the app with no visible benefit. Two windows to test on every platform.
3. **Server-assisted handoff.** The redirect lands on the API, which stores the code under the state and lets the app collect it. Works even if storage were split, but adds an endpoint, a table and a window where an authorization code sits on the server. Needed only if option 1 failed, and it did not.

## Decision

Option 1. The sign-in page saves the state and PKCE verifier in `localStorage`, navigates the whole page to Cognito's `/oauth2/authorize` (with `identity_provider=Google` for Google, which skips managed login), and the redirect URI `/settings/sign-in` exchanges the code at `/oauth2/token`.

- **Tokens.** The session (refresh token, access token and its expiry, the user's `sub` and email from the ID token) is a device setting in Dexie (`settings`, key `authSession`), never synced, validated with Zod on read. The access token lasts 60 minutes and is refreshed on demand one minute before it expires; the refresh token lasts 90 days (`infra/modules/auth`). A refresh answered with `invalid_grant` ends the session as expired, which the app shows as "需要重新登录".
- **Why not a cookie.** An `HttpOnly` refresh cookie would hide the token from scripts, but needs a server endpoint on the site's origin to set and use it, which a static export does not have; the Content-Security-Policy (no inline or third-party scripts) is the defence instead. Safari deletes a site's script-writable storage after seven days of Safari use without interaction with the site; a web app added to the Home Screen has its own count, which runs only while the app itself is used and resets each time the user interacts with it ([WebKit: full third-party cookie blocking and more](https://webkit.org/blog/10218/full-third-party-cookie-blocking-and-more/)), so opening the installed app keeps its session.
- **Sign-out** revokes the refresh token (`/oauth2/revoke`), deletes the session and then navigates to `/logout`, which clears managed login's own cookie so the next sign-in can choose another account.

- **One account per email** (bw's choice, 2026-11-22). Cognito treats a Google identity and an email account with the same address as two users. The pre sign-up trigger (`apps/api/src/cognito/pre-sign-up.ts`) links a first Google sign-in to the confirmed email account with the same verified address (`AdminLinkProviderForUser`), and refuses an email sign-up for an address that already signs in with Google, since a native account cannot be linked into a federated one ([linking federated users](https://docs.aws.amazon.com/cognito/latest/developerguide/cognito-user-pools-identity-federation-consolidate-users.html)). Only a confirmed account with a verified email can receive a Google identity; otherwise someone could sign up with another person's address and later receive their Google sign-ins. Cognito fails the first sign-in after linking with "Already found an entry for username", a known limitation ([AWS re:Post](https://repost.aws/questions/QUgWVkIodQS1W3Yj8MYjInbA)); the sign-in page recognises it and starts one more Google sign-in, which returns the linked account without a visible step, since Google remembers the consent.

## Consequences

- No new endpoint or storage on the server; the API only verifies access tokens (M2-03).
- The redirect URI and the sign-out URL are fixed paths, listed in the Cognito client's callback and logout URLs for each environment.
- Clear all data in Diagnostics also removes the session, because it is a device setting; M2-05 decides how that page warns a signed-in user.
- If a later iOS release opens the authorize page in a separate sheet again, the probe page shows it; option 3 is the fallback.
