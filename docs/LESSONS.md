# Lessons

The project's memory of mistakes. Read "Active rules" before every task. Add an entry in the same PR whenever something goes wrong (see "Learning loop" in `CLAUDE.md`).

## Active rules

Short, imperative rules distilled from the lessons below. Each one links to the lesson that created it. At each milestone retro, rules that have proved themselves get promoted into `CLAUDE.md` or a `docs/*` file (and removed from here); rules that turned out wrong get deleted.

_None yet._

## How to write a lesson

Copy this block to the top of the log. Keep it short; the point is the rule change.

```md
### L-000 · YYYY-MM-DD · <area tag> · <one-line title>
- **What happened:** the symptom, and how it was noticed (bw / CI / review / prod).
- **Root cause:** why it happened — the actual reason, not "a typo". Was a rule missing, unclear, or ignored?
- **Fix:** PR or commit.
- **Prevention:** what changed so it cannot recur — prefer a lint rule, test, type, CI check or hook; else a doc rule (name the file).
- **Status:** guarded (automated check) | documented (prose rule) | open
```

Area tags: `workout`, `food`, `sync`, `auth`, `ai`, `infra`, `ci`, `ui`, `motion`, `i18n`, `pwa`, `tooling`, `process`.

## Log

_Newest first._

## Retros

At the end of each milestone, append a short retro here:

```md
### Retro M0 · YYYY-MM-DD
- Lessons this milestone: L-00x, L-00y
- Promoted to rules: …
- Rules removed or rewritten: …
- What slowed us down most / what to try next milestone: …
```
