# ADR-0003: Data model and sync rules

- Status: accepted
- Date: 2026-11-08

## Context

Gainframe is local first: the UI reads and writes IndexedDB (Dexie) and must work offline at the gym. From M2 the same data lives in Postgres (Neon) so a second device and the server-side AI features can see it. M1 builds the Dexie schema before any server exists, so the rules that the sync engine (M2-04, M2-05) depends on have to be fixed now, or M1 data would need a migration on the phone, where it cannot be repaired from the server.

Constraints: one user per account, one to three devices, mostly sequential use (the phone at the gym, a laptop for review). The server is a Lambda function with no long-lived connections. Device clocks are usually right but not guaranteed. `docs/architecture.md` already lists the tables and the outline: outbox, push/pull, last writer wins.

## Options considered

1. **Row-level last writer wins with an outbox and a server cursor.** Each row carries `updated_at`; the newer row replaces the older one. Small and testable; an edit made on two devices before either syncs keeps only the later one.
2. **Field-level merge** (per-column timestamps). Keeps both edits when they touch different fields. Doubles the columns or needs a change log; the case it fixes (two devices editing the same set offline) is rare for one user.
3. **CRDTs** (Automerge, Yjs) or a sync service (Replicache, ElectricSQL, PowerSync). Correct under any concurrency, but a new dependency or service, opaque storage that Drizzle and SQL queries cannot read directly, and a much larger surface to explain. Rejected for the scale of this app.
4. **Server as source of truth, client as cache.** Simplest server, but the app would not work offline, which is the core requirement.

## Decision

Option 1, with these rules.

### Rows

- Every synced row has `id` (UUIDv7 generated on the client), `user_id`, `created_at`, `updated_at`, `deleted_at` (null unless deleted). Timestamps are UTC ISO strings set by the client when it writes; the day a row counts for is a separate `local_date` (see `CLAUDE.md`).
- `user_id` is never accepted from a client. The push schema has no `user_id` field; the server sets it from the verified JWT. In M1 (no account) Dexie rows have `user_id` null; M2-06 fills it on first sign-in and queues every row for push.
- The server adds one column the client never writes: `server_version`, a per-user counter (see "Pull").
- Built-in exercises are not rows. They ship as a constant in `packages/shared` with fixed UUIDs, so every device and the server agree on their IDs without syncing them. The `exercises` table holds custom exercises only, and `is_builtin` is dropped.
- Server-authored tables (`weekly_summaries`, `nudges`) are pulled, never pushed. `ai_usage` and `push_subscriptions` are not synced at all; they have their own endpoints. M5 decides how "nudge read" is recorded, without letting a client overwrite server-authored fields.
- `profiles` has one row per user in meaning. Amended 2026-11-22 (M3-02): it is stored by `id` like every other synced table, because a device sets its targets before it has a `user_id`, and two devices may each create a row before their first sync. Every device reads the most recently updated live row and writes its changes to that row, so the latest change wins as it does for any row, without a special case in push or pull.
- No foreign keys between synced tables on the server. Rows arrive in batches and may reference a parent that is in a later batch or soft-deleted; the client hides rows whose parent is missing or deleted. Ownership is still enforced: every query is scoped by `user_id`, and a pushed `id` that already exists under another user is rejected.

### Writes on the device

- A write updates the row (setting `updated_at`) and adds an outbox entry `{ seq, table, rowId }` in the same Dexie transaction, so a crash cannot leave a change that never syncs.
- A delete sets `deleted_at` and `updated_at`; it is an ordinary update. Deleting a parent (a workout, a template, a meal) soft-deletes its children in the same transaction. Tombstones are kept.

### Push (`POST /api/sync/push`)

- The client reads the outbox in `seq` order, collapses entries for the same row, and sends the row's current values in batches (size limit in config).
- For each row the server upserts by `id` when the incoming `updated_at` is later than the stored one, and ignores it otherwise. An equal `updated_at` is ignored, which makes a replayed batch a no-op.
- A row whose `updated_at` is further in the future than the allowed clock skew (config) is rejected, so a device with a wrong clock cannot win every later conflict.
- The response gives a status per row: `applied`, `ignored` (older or equal) or `rejected` (validation or ownership, with Zod issue paths). The client removes outbox entries up to the pushed `seq` only for rows not changed since they were read.
- Columns a client does not send keep their stored value. Optional fields are nullable and always sent, so clearing a field sends `null`; an omitted field means "this client version does not know it", which keeps an older app from wiping a column added later.

### Pull (`GET /api/sync/pull?cursor=`)

- Push takes a row lock on the user's sync state (`UPDATE ... RETURNING`) and stamps each applied row with the next `server_version`. Pushes for one user are therefore serialized, and a pull reads `server_version > cursor` ordered by `server_version` with a page limit. A transaction still in flight always holds higher versions than any committed row, so a pull can never skip it. Wall-clock timestamps are not used as a cursor because concurrent transactions can commit out of order.
- The client applies a pulled row with the same rule as the server: only if its `updated_at` is later than the local one. Pulled writes do not create outbox entries. The cursor is stored after the page is applied.

### Sign-out and schema changes

- Sign-out pushes the outbox first; if that fails it warns before deleting the local database.
- Every push and pull sends the client's schema version. The server answers a version it no longer supports with an error code that tells the app to update instead of syncing. Server schema changes are additive between client versions (new nullable columns), and each Dexie version has an upgrade test (`docs/conventions.md`).

## Consequences

- M1-01 and M1-02 build to these rules from the start: the shared row fields, the outbox table, transactional writes and soft deletes, and the built-in exercise constant.
- Conflicts lose data only when two devices edit the same row before either syncs; the later edit wins whole. M2-04's conflict test documents that case.
- The server's tables mirror Dexie, plus `server_version` and per-user sync state. Drizzle and SQL can read every table directly, which the AI features (M5, M6) rely on.
- Correctness depends on device clocks being roughly right; the skew limit bounds the damage, and the pull cursor never depends on them.
- Tombstones grow without bound. At this scale that is a few thousand rows a year; purging them would need every device to have pulled them first, so it is left until it matters.
- A per-user override for a built-in exercise (for example its default rest) needs its own table; it is not part of v1.
