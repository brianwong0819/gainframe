# Code conventions

Short on purpose. If a rule here is enforceable by ESLint, TypeScript or CI, it should be enforced there (M0-04) — this file explains the why.

## TypeScript

- `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`. ESM only.
- Types are inferred from Zod schemas in `packages/shared` (`z.infer`). Do not hand-write a type that a schema already describes.
- Prefer plain functions and plain objects. Classes only where a library expects them (Dexie).
- Errors: throw typed errors in services; routes map them to the shared error shape `{ error: { code, message } }`. Never swallow an error with an empty `catch`.
- Naming: `camelCase` values, `PascalCase` types/components, `SCREAMING_SNAKE` for true constants, `kebab-case` file names. DB columns `snake_case`; Drizzle maps them.
- No barrel files (`index.ts` re-exporting everything) except the public entry of `packages/shared`.

## React (apps/web)

- Feature code lives in `src/features/<feature>`. A component used by two features moves to `src/ui`.
- Components read data through hooks that wrap Dexie live queries (`useLiveQuery`). No fetching in components.
- Local UI state with `useState`/`useReducer`; cross-screen state (active workout, rest timer) in one small store per concern. No global state library.
- Every interactive element is keyboard- and screen-reader-accessible (Radix where it applies). Tap targets ≥ 44×44 px.
- All user-facing text through next-intl. Numbers and dates formatted with `Intl` using the user's locale.

## API (apps/api)

- Route handler: parse with Zod → call a service → return. No SQL in routes.
- Every route except `/health` requires auth middleware; `userId` comes from the context, never from input.
- Responses are typed by shared schemas so the web app gets the same types.
- Structured logs (JSON) with request ID; never log bodies, tokens, keys or images.

## Tests

- **Unit (Vitest):** every function in `packages/shared/src/domain`, every service branch, every Zod schema with tricky rules. Name tests by behaviour: `it('does not count warm-up sets toward a PR')`.
- **Integration (Vitest + Postgres in Docker/CI):** every API route, including an ownership test (user A cannot read/modify user B's rows).
- **E2E (Playwright, iPhone viewport):** the critical flows listed in ROADMAP. Offline is simulated with `context.setOffline(true)`.
- Fixtures are explicit and small; no snapshot tests of large objects; no tests that depend on the current date (inject a clock).
- A bug fix starts with a failing test that reproduces it.

## Git

- Branch: `m<milestone>/<nn>-<slug>` (e.g. `m1/05-set-logger`). Never commit to `main`.
- Commits: Conventional Commits (`feat(workout): …`, `fix(sync): …`, `chore`, `docs`, `test`, `refactor`, `ci`, `infra`). One logical change per commit.
- PR title: `<type>(<scope>): <summary> [M1-05]`. Squash-merge.
- Lockfile changes only with a matching `package.json` change.

## Dependencies

Before proposing a new package, answer in the PR: what it does that the current stack can't, size (bundle impact for web), last release date, licence, and alternatives considered. Pin exact versions (`pnpm` with `save-exact`).
