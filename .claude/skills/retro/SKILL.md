---
name: retro
description: End-of-milestone retro for Gainframe — review lessons, promote recurring ones into rules or automated checks, prune stale rules, and propose the doc changes as a PR.
---

1. Read `docs/LESSONS.md`, `CLAUDE.md`, `docs/STATUS.md` and the milestone's section of `docs/ROADMAP.md`. Look at the milestone's merged PRs (`gh pr list --state merged --search "[M<n>-"`) and their review comments.
2. Group the lessons by root cause. For every group:
   - Recurring or costly → promote: turn it into an automated guard if possible (lint rule, test, type, CI check, hook); otherwise a rule in `CLAUDE.md` or the matching `docs/*` file.
   - One-off and already guarded → leave it in the log.
3. Prune: remove or rewrite rules that were wrong, never applied, or duplicated. Keep `CLAUDE.md` under ~200 lines — move detail into `docs/`.
4. Check the plan: does the next milestone in ROADMAP still make sense given what we learned? Propose changes (split, reorder, drop) — don't apply them silently.
5. Note month-to-date AWS cost and how Claude usage went (which tasks were expensive and why).
6. Append the retro to `docs/LESSONS.md` and open one PR `docs(process): M<n> retro` with all rule changes, explained in Chinese for bw.
