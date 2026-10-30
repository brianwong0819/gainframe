---
name: start-task
description: Start the next Gainframe ROADMAP task — load status, lessons and the task, create the branch, and post a plan for bw before writing code.
---

1. Read `docs/STATUS.md`, the "Active rules" in `docs/LESSONS.md` (plus any lessons tagged with this task's area), and the task's entry in `docs/ROADMAP.md`. If the user named a task ID in the arguments, use that one; otherwise use STATUS's current task.
2. Read only the docs the task touches (see the table in `CLAUDE.md`). For library APIs, look them up with context7 for the versions in `package.json`.
3. `git switch main && git pull`, then `git switch -c m<milestone>/<nn>-<slug>`.
4. Post a plan to bw, in Chinese:
   - 目标（one sentence, from ROADMAP）
   - 会改的文件 / 新增的文件
   - 做法 and any choice between options (with your recommendation)
   - 怎么验证（the task's 验证 step + tests you will add）
   - 风险或不清楚的地方
   - 建议模型（see `docs/working-with-claude.md`）
5. If the task has a design choice, touches infra/auth/sync/AI, or is likely > 1 hour: wait for bw's OK. Otherwise continue.
6. Update `docs/STATUS.md` "Current task" and commit it as the first commit on the branch.
