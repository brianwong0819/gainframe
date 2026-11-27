# Working with Claude: models and token budget

Goal: never run out of usage mid-milestone, and spend the expensive model only where it changes the outcome.

## Pick the model by the job

| Job | Model | Why |
|---|---|---|
| Planning a milestone, architecture/ADR decisions, a bug that survived two attempts, security review, AI prompt design | **Opus** (`/model opus`) | Mistakes here are expensive to undo |
| Normal ROADMAP tasks: implement, write tests, fix CI, refactor inside one feature | **Sonnet** (`/model sonnet`) — the default | Strong enough for well-specified tasks, much cheaper |
| Mechanical work: data entry (food table, exercise catalog), renames, copy/i18n edits, small fixes, doc tidying | **Sonnet** | Cheap enough; a weaker model costs more in rework than it saves |
| The global review at mid-milestone and at the retro | **Opus** | It decides the next tasks |
| Unsure? | `opusplan` — Opus while planning (plan mode), Sonnet while executing | Good default for bigger tasks |

Rules of thumb:
- The plan step of `/start-task` is where thinking pays off. A good plan lets Sonnet do the rest.
- Raise effort (`/effort high`) only for hard debugging or design; keep it at the default otherwise.
- Do not switch to Opus just because a test fails — read the error first. Switch after two failed attempts (CLAUDE.md "When things go wrong").

## Keep context small (this is most of the token bill)

- **One task per session.** `/clear` after a PR is opened. `docs/STATUS.md` carries the context forward, not the chat.
- `/compact` when a session gets long but the task isn't finished; say what to keep (e.g. `/compact keep the plan and the failing test output`).
- Point Claude at files instead of letting it explore: "read `apps/web/src/features/workout/SetRow.tsx`" beats "find the set row".
- Don't paste huge logs; paste the failing part. Don't let Claude `cat` lockfiles, build output, `node_modules`, or `docs/design/prototype.html` in full (search it).
- CLAUDE.md is loaded every turn, so it stays short (< ~200 lines); detail lives in `docs/` and is read only when needed.
- Subagents are not free — each starts from scratch. Use them only for wide searches or independent reviews.
- Skills/plugins and MCP servers add tool definitions to every request. Install only what `docs/tooling.md` recommends, and disable an MCP server you are not using this milestone (`/mcp`).

## Project threads (Claude Projects)

Most work runs in project threads started by the coordinator. Each thread carries its whole conversation as context, so a long thread costs more per turn and answers worse. The rules:

- **One thread, one small task.** A thread is one ROADMAP task or one bug, usually one to three PRs. A second, unrelated ask goes to a new thread, not onto the end of this one.
- **Check before starting.** List the open threads and PRs first. If one already covers the work, continue it there; two threads never build the same thing.
- **A PR belongs to its thread.** Another thread touches it only to unblock a merge (a conflict, a broken import after a main change) and says so in the PR.
- **Hand over before the context is long.** After about three PRs, or once a thread has been compacted, stop at a clean point: update the "Current task" line in `docs/STATUS.md`, then ask the coordinator for a new thread with a handoff of at most ten lines (goal, what is merged, open PRs, the next step, what waits on bw, container notes).
- **Do not park threads.** A thread waiting on bw or an outside party (AWS Support, a console step) records the wait under "Blocked on bw" in `docs/STATUS.md` and is resolved; a new thread picks the work up when the wait ends. A thread stays open only while it owes a next step itself.
- **Close finished threads.** A thread is resolved when its PRs are merged and nothing is owed.
- **Pick the model per thread** from the table above; the coordinator states it when starting the thread.

## Budget habits

- Check `/usage` (or `/cost`) at the start and end of a session; note in STATUS if a task was unusually expensive and why (that's a lesson).
- Batch small fixes into one session instead of opening many.
- Heavy jobs (Strix scans, big refactors, eval runs that call models) — schedule them when you have budget left in the week.
- Bedrock/API spend for the app itself is separate from Claude Code usage; it's capped in `docs/ai.md`.
