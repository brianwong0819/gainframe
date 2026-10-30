---
name: start-task
description: Start the next Gainframe ROADMAP task — load status, lessons and the task, create the branch, and post a plan for bw before writing code.
---

1. Read `docs/STATUS.md`, the "Active rules" in `docs/LESSONS.md` (plus any lessons tagged with this task's area), and the task's entry in `docs/ROADMAP.md`. If the user named a task ID in the arguments, use that one; otherwise use STATUS's current task.
2. Read only the docs the task touches (see the table in `CLAUDE.md`). For library APIs, look them up with context7 for the versions in `package.json`.
3. `git switch main && git pull`, then `git switch -c m<milestone>/<nn>-<slug>`.
4. Post a plan to the owner in chat, covering:
   - Goal (one sentence, from ROADMAP)
   - Files to change / add
   - Approach, and any choice between options (with your recommendation)
   - Verification (the task's Verify step + tests you will add)
   - Risks or open questions
   - Suggested model (see `docs/working-with-claude.md`)
   - New concepts bw will meet in this task, explained briefly
5. If the task has a design choice, touches infra/auth/sync/AI, or is likely > 1 hour: wait for bw's OK. Otherwise continue.
6. Update `docs/STATUS.md` "Current task" and commit it as the first commit on the branch.
