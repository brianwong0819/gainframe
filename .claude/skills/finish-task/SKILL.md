---
name: finish-task
description: Finish the current Gainframe task — verify, self-review, record lessons, update ROADMAP/STATUS and open the PR.
---

1. Run `pnpm check` and `pnpm build` (once they exist), and run `pnpm check` again as the last command before each commit (L-031). Fix everything; never skip, weaken or delete a test to get green.
2. Do the task's Verify step from `docs/ROADMAP.md` yourself as far as possible. UI: screenshots at 390×844 in light and dark; reduced-motion checked. AI: run the matching eval and keep the output.
3. Review `git diff main...HEAD` line by line against `CLAUDE.md` hard rules and `docs/conventions.md`. Delete anything not needed for this task (debug code, unused exports, speculative options). Then run `/code-review`.
4. Learning loop: did anything go wrong in this task (a bug, a failed approach, a wrong API, a rule that was unclear, a correction from bw)? For each, add an entry to `docs/LESSONS.md` and make the prevention change (check, test, lint rule or doc rule) in this PR. If nothing went wrong, say so.
5. Tick the task in `docs/ROADMAP.md`; update `docs/STATUS.md` (current/next task, follow-ups, blockers, pending iPhone checks). Replace its "Now" section instead of appending a changelog entry; what the task built belongs in the PR. Keep the file under 100 lines.
6. Look ahead: re-read the rest of the milestone and every later ROADMAP task this change touches (same files, schemas, workflows or rules). Update the plan in this PR where it no longer fits, and note in the PR what was checked. If this task is the milestone's midpoint, also run the whole-repository review described in `CLAUDE.md` ("Look ahead").
7. Push the branch and open the PR with `.github/pull_request_template.md` filled in — in professional English, including real command output. Title: `<type>(<scope>): <summary> [M?-??]`.
8. Tell the owner in chat: the PR link, how the change works and why, what to check first, and what you'd suggest next. Then suggest `/clear` before the next task.
