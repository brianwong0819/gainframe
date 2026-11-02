# Lessons

The project's memory of mistakes. Read "Active rules" before every task. Add an entry in the same PR whenever something goes wrong (see "Learning loop" in `CLAUDE.md`).

## Active rules

Short, imperative rules distilled from the lessons below. Each one links to the lesson that created it. At each milestone retro, rules that have proved themselves get promoted into `CLAUDE.md` or a `docs/*` file (and removed from here); rules that turned out wrong get deleted.

- Verify a claim with the command that proves it (`git status`, `pnpm check`, `--version`) and quote its output; a file listing is not proof. ([L-002](#l-002--2026-10-30--process--reported-a-repo-move-as-correct-when-git-was-missing))
- Before planning steps against a vendor console or account model (AWS, Neon, GitHub), read the vendor's current docs for that exact flow; do not plan from memory. ([L-004](#l-004--2026-11-02--infra--m0-03-was-planned-against-the-old-aws-account-model))
- When asking bw for a screenshot or terminal output, say first what to mask (passwords, account IDs, tokens). ([L-005](#l-005--2026-11-02--process--a-password-appeared-in-a-shared-screenshot))
- Setup/how-to docs check each prerequisite first (`<tool> --version`) and give the fallback if it is missing. ([L-001](#l-001--2026-10-30--tooling--setup-guide-assumed-winget-exists))

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

### L-005 · 2026-11-02 · process · A password appeared in a shared screenshot
- **What happened:** following CLI instructions that included a password argument, bw shared a terminal screenshot that showed the typed password. The command failed, so the password was never set.
- **Root cause:** the instructions put a secret on the command line and did not say what to hide before sharing output.
- **Fix:** bw was told not to reuse that password anywhere.
- **Prevention:** instructions never put secrets on a command line when a prompt or console form exists, and every request for a screenshot or output names what to mask (rule added under "Active rules").
- **Status:** documented

### L-004 · 2026-11-02 · infra · M0-03 was planned against the old AWS account model
- **What happened:** ROADMAP M0-03 told bw to create an IAM Identity Center admin user and work in `ap-southeast-1`. On the 2026 account plan, Identity Center and IAM-user console passwords are blocked by AWS-managed SCPs, and the account was region-locked to `ap-southeast-2`. Several attempts (an IAM user, CloudShell `create-login-profile`) failed before the cause was found.
- **Root cause:** the account steps were written from memory of the pre-2026 account model; AWS's current sign-up and account-plan docs were not read while planning.
- **Fix:** advanced features activated and the Region SCP edited ([ADR-0001](adr/0001-aws-account-model.md)); `docs/infra.md` and `docs/setup-windows.md` updated.
- **Prevention:** `docs/infra.md` now records the account structure and guardrails; rule added under "Active rules" to read the vendor's current docs before planning console or account steps.
- **Status:** documented

### L-003 · 2026-10-30 · tooling · User-level installs from a remote session did not reach bw's terminal
- **What happened:** fnm's Node 24 and pnpm were installed through a remote session and reported working, but in bw's own PowerShell `fnm list` showed only `system`.
- **Root cause:** the remote session's user environment (fnm directory / PATH) differed from bw's interactive shell; the check ran in the session's shell, not bw's.
- **Fix:** bw re-ran `fnm install 24; fnm default 24; corepack enable` in their own terminal.
- **Prevention:** after any remote install, the final check is run by bw in a freshly opened terminal; per-user tools (fnm, Node, pnpm, shell profile) are installed in bw's own terminal.
- **Status:** documented

### L-002 · 2026-10-30 · process · Reported a repo move as correct when `.git` was missing
- **What happened:** after bw moved the repo to `C:\dev\gainframe`, Claude listed the folder, saw the expected files and said it was correct. The `.git` folder was gone, so it was not a git repository.
- **Root cause:** checked by eye against a file list instead of running the check the doc itself gives (`git status`); "the files look right" was taken as proof.
- **Fix:** re-clone from GitHub; setup doc already says to verify with `git status`.
- **Prevention:** verify with the real command's output, never by inspecting a listing (rule added under "Active rules").
- **Status:** documented

### L-001 · 2026-10-30 · tooling · Setup guide assumed `winget` exists
- **What happened:** bw ran `winget install --id Git.Git` from `docs/setup-windows.md` and got "winget is not recognized".
- **Root cause:** the guide was written for a fresh, fully updated Windows and never checked its own prerequisites; it also skipped "open a new terminal after installing" and the PowerShell profile/execution-policy steps.
- **Fix:** PR `m0/02-winget-fallback`.
- **Prevention:** setup docs start each section with a one-line check of their prerequisite and give the fallback when it fails (rule added under "Active rules").
- **Status:** documented

## Retros

At the end of each milestone, append a short retro here:

```md
### Retro M0 · YYYY-MM-DD
- Lessons this milestone: L-00x, L-00y
- Promoted to rules: …
- Rules removed or rewritten: …
- What slowed us down most / what to try next milestone: …
```
