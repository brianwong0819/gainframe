# Code conventions

Short on purpose. If a rule here is enforceable by ESLint, TypeScript or CI, it should be enforced there (M0-04) — this file explains the why.

## TypeScript

- `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`. ESM only.
- Types are inferred from Zod schemas in `packages/shared` (`z.infer`). Do not hand-write a type that a schema already describes.
- Prefer plain functions and plain objects. Classes only where a library expects them (Dexie).
- Errors: throw typed errors in services; `app.onError` maps them to the shared error shape `{ error: { code, message, requestId } }` (`apiErrorSchema` in `packages/shared`). Never swallow an error with an empty `catch`.
- Naming: `camelCase` values, `PascalCase` types/components, `SCREAMING_SNAKE` for true constants, `kebab-case` file names. DB columns `snake_case`; Drizzle maps them.
- Schema fields are `camelCase` (`weightKg`, `localDate`); the column names in `docs/architecture.md` are their `snake_case` database form. Optional fields are `.nullable()`, never `.optional()`, so a client always sends them ([ADR-0003](adr/0003-data-model-and-sync.md)).
- A `local_date` has the branded type `LocalDate`; outside tests it comes only from `toLocalDate`.
- No barrel files (`index.ts` re-exporting everything) except the public entry of `packages/shared`.

## React (apps/web)

- Feature code lives in `src/features/<feature>`. A component used by two features moves to `src/ui`.
- Components read data through hooks that wrap Dexie live queries (`useLiveQuery`). No fetching in components. A query run by `useLiveQuery` calls Dexie directly for every read; awaiting one of our own async helpers first loses the context Dexie uses to observe the later reads, and the screen stops updating (L-026).
- Local UI state with `useState`/`useReducer`; cross-screen state (active workout, rest timer) in one small store per concern. No global state library.
- Unexpected errors are recorded through `src/diagnostics`, never `console.*` (which nobody can read on the iPhone).
- The static export prerenders every control, so it is visible before React attaches its handlers. A button that writes (create, start, add) renders only once the data it acts on has loaded; an e2e test delays the JavaScript chunks and taps at once (L-028).
- Every interactive element is keyboard- and screen-reader-accessible (Radix where it applies). Tap targets ≥ 44×44 px.
- All user-facing text through next-intl. Numbers and dates formatted with `Intl` using the user's locale.

## API (apps/api)

- Route handler: parse with Zod → call a service → return. No SQL in routes.
- Every route except `/health` requires auth middleware; `userId` comes from the context, never from input.
- Responses are typed by shared schemas so the web app gets the same types.
- Log only through `src/log.ts`, with primitive fields (`log.info('sync push', { received: 12, applied: 11 })`). Never log bodies, query strings, headers, tokens, keys, images or emails. Design: "Observability" in `docs/architecture.md`.
- Log an unexpected error once, where it is handled (normally `app.onError`); do not log and rethrow. Expected outcomes (validation failure, not found) are `info` or `warn`, not `error`, so the error alarm stays meaningful.
- External calls (database, model providers, S3) always have a timeout.

## Tests

- **Unit (Vitest):** every function in `packages/shared/src/domain`, every service branch, every Zod schema with tricky rules. Name tests by behaviour: `it('does not count warm-up sets toward a PR')`.
- **Integration (Vitest + Postgres in Docker/CI):** every API route, including an ownership test (user A cannot read/modify user B's rows). Files end in `.int.test.ts` and run with `pnpm test:integration` (after `pnpm db:up`); `pnpm check` runs unit tests only.
- Every test runs with `TZ=America/Los_Angeles` (set in `vitest.config.ts`, guarded by `packages/shared/src/time-zone.test.ts`), so a day derived from a UTC timestamp fails locally too.
- **E2E (Playwright, iPhone viewport):** the critical flows listed in ROADMAP. WebKit runs only in CI (the cloud container has Chromium only), so write each test for the slowest, strictest engine:
  - After a write, wait for the screen to show the stored value before navigating or reloading (L-024); assert each entered value right away (`toHaveValue`) and enter text with `fill` (L-027).
  - While a modal sheet is open, WebKit hides the page behind it from role queries: check the page after the sheet has closed (L-027).
  - Swipes and drags dispatch touch pointer events (`swipeLeft` in `e2e/history.spec.ts`); Playwright's mouse in emulated WebKit ends a drag as a click (L-029).
  - Offline is a server the test owns being shut down (`e2e/site-server.ts`); in WebKit `context.setOffline` and `context.route` also block navigations the service worker would answer (L-033).
  - Run a new or changed spec locally with `--repeat-each 5` before pushing (L-024).
  - A spec that needs an exercise missing from the library, or a set number of search results, says so in a comment; a change to the built-in catalog runs the specs that search it (`grep -l searchbox apps/web/e2e`) before pushing (L-036).
  - A test that samples an animation frame by frame takes its first sample from the DOM change that starts the animation (a `MutationObserver`), not from the first `requestAnimationFrame` after the action: on a slow runner that frame is late (L-034).
- **Device layout (Playwright, `apps/web/e2e/layout.spec.ts`):** every page on six iPhone and Android sizes, light and dark, with simulated safe-area insets (pull requests run two of them; `main` runs all six). Add each new page to its list. Details: "Device QA" in `docs/design-system.md`.
- **Critical flows (Playwright, `apps/web/e2e/offline.spec.ts`):** the whole workout flow offline from the service worker's precache, the one spec that allows the service worker. A change to the worker, routing or the workout flow keeps it green.
- Every Dexie schema version after v1 gets an upgrade test: open at the previous version with fixture rows, upgrade, assert the rows survive. Data on the phone cannot be repaired from the server.
- Fixtures are explicit and small; no snapshot tests of large objects; no tests that depend on the current date (inject a clock).
- A bug fix starts with a failing test that reproduces it.

## Git

- Branch: `m<milestone>/<nn>-<slug>` (e.g. `m1/05-set-logger`); work outside a numbered task uses `m<milestone>/<slug>` (e.g. `m0/review-maintainability`). Never commit to `main`.
- Commits: Conventional Commits (`feat(workout): …`, `fix(sync): …`, `chore`, `docs`, `test`, `refactor`, `ci`, `infra`). One logical change per commit.
- PR title: `<type>(<scope>): <summary> [M1-05]`. Squash-merge.
- Lockfile changes only with a matching `package.json` change.

## Dependencies

Before proposing a new package, answer in the PR: what it does that the current stack can't, size (bundle impact for web), last release date, licence, and alternatives considered. Pin exact versions (`pnpm` with `save-exact`).
