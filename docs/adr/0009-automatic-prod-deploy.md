# ADR-0009: Deploy prod automatically, with checks that stop for the owner

- Status: accepted
- Date: 2026-11-27

## Context

Since M2-07, every merge deploys dev and then waits in the `prod` Environment until the owner approves. Merges come several times a day, and the owner approves each one by hand without reviewing anything a check could not see. A merge already passes CI (unit, integration and WebKit device tests) and a full dev deploy with its smoke test before prod is considered. What a person adds is judgement on changes that are hard to undo: infrastructure that is deleted or replaced, and database migrations that are not backward compatible.

## Options considered

1. **Keep the manual approval.** Safe, but prod lags behind main until the owner approves, and an approval given without looking adds nothing.
2. **Deploy prod once a night.** Fewer prod releases, but fixes wait until the next day, and the same checks are still needed.
3. **Deploy prod after every dev deploy, and stop for the owner only on a risky change.** Prod follows main within minutes; the owner sees only the changes that need judgement; a failed deploy is rolled back without waiting for anyone.

## Decision

Option 3, chosen by the owner. The `Check prod changes` job plans prod and sends the run to the `prod-approval` Environment (owner as required reviewer) when the plan deletes or replaces a resource, when a migration added since the serving release contains a drop, rename, type change, `SET NOT NULL` or bulk data change (`.github/scripts/risky-migrations.sh`), or when prod serves no known release. Otherwise `Deploy prod` runs without a person. If it fails, `Roll prod back` redeploys the release that was serving, unless that rollback would delete a resource.

## Consequences

- A defect that CI, the dev smoke test and the prod smoke test cannot see (a layout or logic bug) reaches prod within minutes of a merge. The app is offline first and applies a new version only when the user taps "Update", so a release never changes under a workout in progress.
- The database is never rolled back. Rollback relies on every migration being additive, which the check enforces for automatic deploys; a risky migration always has the owner's approval.
- The `prod` Environment no longer requires a reviewer; it still allows only `main` and still gives the OIDC subject `environment:prod`, so the apply role's trust policy is unchanged.
- The pattern list in `risky-migrations.sh` is a guard, not proof: a destructive statement it does not name passes. Migrations are still reviewed in their pull requests.
