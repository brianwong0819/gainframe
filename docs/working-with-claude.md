# Working with Claude: models and token budget

Goal: never run out of usage mid-milestone, and spend the expensive model only where it changes the outcome.

## Pick the model by the job

| Job | Model | Why |
|---|---|---|
| Planning a milestone, architecture/ADR decisions, a bug that survived two attempts, security review, AI prompt design | **Opus** (`/model opus`) | Mistakes here are expensive to undo |
| Normal ROADMAP tasks: implement, write tests, fix CI, refactor inside one feature | **Sonnet** (`/model sonnet`) — the default | Strong enough for well-specified tasks, much cheaper |
| Renames, copy/i18n edits, formatting, small doc updates, searching the codebase (Explore subagent) | **Haiku** (`/model haiku`) | Mechanical work |
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

## Budget habits

- Check `/usage` (or `/cost`) at the start and end of a session; note in STATUS if a task was unusually expensive and why (that's a lesson).
- Batch small fixes into one session instead of opening many.
- Heavy jobs (Strix scans, big refactors, eval runs that call models) — schedule them when you have budget left in the week.
- Bedrock/API spend for the app itself is separate from Claude Code usage; it's capped in `docs/ai.md`.
