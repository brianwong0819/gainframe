# Lessons

The project's memory of mistakes. Read "Active rules" before every task. Add an entry in the same PR whenever something goes wrong (see "Learning loop" in `CLAUDE.md`).

## Active rules

Short, imperative rules distilled from the lessons below. Each one links to the lesson that created it. At each milestone retro, rules that have proved themselves get promoted into `CLAUDE.md` or a `docs/*` file (and removed from here); rules that turned out wrong get deleted.

- Steps for bw on the iPhone describe the home-screen app as it is: no address bar, opens at `/`; reach a page through an in-app link. ([L-017](#l-017--2026-11-07--pwa--test-steps-told-bw-to-type-a-url-into-the-installed-app))
- Before fixing how a platform draws the app (iOS, Android, browser chrome), find its current documented behaviour and cite it in the PR. ([L-016](#l-016--2026-11-06--pwa--the-status-bar-blur-still-covered-the-title-after-l-015))
- Pad screens by the safe-area inset plus a gutter ("Screen edges" in `docs/design-system.md`), and verify safe-area layout on the iPhone; desktop browsers report zero insets. ([L-015](#l-015--2026-11-06--pwa--the-page-title-sat-under-the-ios-status-bar-blur))
- At the end of every task, check the later ROADMAP tasks it affects; halfway through each milestone, review the whole repository and plan. ([L-009](#l-009--2026-11-02--process--plan-and-code-problems-surfaced-in-a-batch))
- Name every branch `m<milestone>/<nn>-<slug>` (or `m<milestone>/<slug>` for work outside a numbered task), even when a session suggests another name. ([L-008](#l-008--2026-11-02--process--a-pr-shipped-from-an-auto-generated-branch-name))
- Refer to an ADR by number only once it exists; for a planned ADR, name its topic. ([L-007](#l-007--2026-11-02--process--two-documents-claimed-adr-0001))
- Write deny patterns for secret files with `**/` so they cover every workspace, and re-check them when a task adds a new secret file. ([L-006](#l-006--2026-11-02--tooling--claude-code-could-read-appsapienv))
- Verify a claim with the command that proves it (`git status`, `pnpm check`, `--version`) and quote its output; a file listing is not proof. ([L-002](#l-002--2026-10-30--process--reported-a-repo-move-as-correct-when-git-was-missing))
- Before planning steps against a vendor console or account model (AWS, Neon, GitHub), read the vendor's current docs for that exact flow; do not plan from memory. ([L-004](#l-004--2026-11-02--infra--m0-03-was-planned-against-the-old-aws-account-model))
- When asking bw for a screenshot or terminal output, say first what to mask (passwords, account IDs, tokens). ([L-005](#l-005--2026-11-02--process--a-password-appeared-in-a-shared-screenshot))
- Quote every PowerShell argument that contains `=` or `.` after a leading `-` (`terraform plan "-out=x.tfplan"`); bw runs commands in PowerShell, not bash. ([L-010](#l-010--2026-11-03--infra--a-terraform-flag-broke-in-powershell))
- Every command block written for bw starts with `cd` to an absolute path (`cd C:\dev\gainframe`), and every download step names its fallback when the network fails. ([L-011](#l-011--2026-11-03--infra--the-dev-first-apply-steps-failed-on-bws-machine))
- Verify an identity or permission change (trust policy, IAM policy, secret) by exercising it from the real caller, such as a workflow run, not by reading the resource. ([L-012](#l-012--2026-11-04--infra--the-ci-roles-trust-policies-never-matched-githubs-oidc-subject))
- In workflow scripts, run a command whose failure matters on its own, not inside a pipeline or `$(...)` with other commands; smoke tests assert the healthy result, not just a response. ([L-014](#l-014--2026-11-06--ci--the-smoke-test-passed-while-the-api-could-not-reach-its-database))
- In scripts, parse AWS CLI results as JSON (`--output json` piped to `jq`); text output repeats values once per page. ([L-013](#l-013--2026-11-04--ci--the-first-deploys-smoke-test-failed-on-cli-output))
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

### L-017 · 2026-11-07 · pwa · Test steps told bw to type a URL into the installed app
- **What happened:** The M0-13 handover asked bw to open `/dev/rest-timer.html` by typing the address inside the home-screen app. bw asked whether to delete and re-add the app; an installed web app has no address bar and always opens at the manifest `start_url`, so the page was unreachable.
- **Root cause:** The steps were written for a browser tab, not for the standalone app the test required. No rule said how bw reaches a page on the iPhone.
- **Fix:** PR `m0/13-dev-page-links` (dev builds link the dev pages from the home page); corrected in chat.
- **Prevention:** Active rule below; every new dev page gets a link from the dev home page (`src/app/page.tsx`).
- **Status:** documented

_Newest first._

### L-016 · 2026-11-06 · pwa · The status bar blur still covered the title after L-015
- **What happened:** after the L-015 fix bw re-installed the app; the title was below the status bar but still partly blurred.
- **Root cause:** L-015 treated the blur as a strip of fixed height and added a gutter. iOS 26+ instead paints a progressive "scroll pocket" blur over the top of an installed web app, well below the status bar, and removes it only when an opaque `position: fixed` element touches the top edge across at least 80% of the width. Nobody looked up how the current iOS draws installed web apps before fixing; the first fix was a guess.
- **Fix:** PR `m0/launch-polish`: a fixed `.status-bar-fill` strip in the root layout, the status bar's height, in `--bg`.
- **Prevention:** before fixing platform rendering behaviour (iOS/Android/browser chrome), search for the current platform's documented behaviour and cite it in the PR; the cross-device QA work (`m0/device-qa`) adds automated device checks.
- **Status:** documented

### L-015 · 2026-11-06 · pwa · The page title sat under the iOS status bar blur
- **What happened:** after M0-12 bw installed the app on the iPhone; the "Gainframe" heading started at the very left edge and directly under the status bar, where iOS blurs the content, so it was hard to read.
- **Root cause:** `body` was padded by exactly the safe-area insets, with no gutter, although the prototype pads screens by the inset plus 20 px. The Chromium check could not catch it: desktop Chromium reports zero safe-area insets.
- **Fix:** PR `m0/12-safe-area-spacing`: `body` padding is the inset plus `--space-20` at the top and bottom and `max(--space-20, inset)` at the sides.
- **Prevention:** "Screen edges" in `docs/design-system.md` states the padding rule; anything that depends on safe areas is verified on the iPhone, not in a desktop browser.
- **Status:** documented

### L-014 · 2026-11-06 · ci · The smoke test passed while the API could not reach its database
- **What happened:** bw opened `/api/health` on dev and got `{"status":"error","database":"unreachable"}`. The deploy logs of 2026-11-04 and 2026-11-05 both show `curl: (22) ... 503`, yet the smoke test passed. CloudWatch showed `password authentication failed for user 'neondb_owner'`: the Neon `dev` branch behind the SSM connection string no longer existed. The Neon console creates a branch with "Auto-delete: after 1 day" by default.
- **Root cause:** the health request ran as `$(curl -f ... | tr | awk)`. Bash takes a pipeline's exit status from its last command, so curl's failure was discarded and the step only checked that a request ID came back. The smoke test asserted that the API answered, not that it was healthy. Separately, the dev setup steps never mentioned the Neon branch, so its auto-delete default went unnoticed.
- **Fix:** PR `m0/smoke-test-health`: the smoke test requires status 200 and `database: connected`, with curl outside any pipeline. bw recreated the `dev` branch with auto-delete off and wrote its connection string to SSM; `infra/envs/dev/README.md` now names the branch and the setting.
- **Prevention:** in workflow scripts, never put a command whose failure matters inside a pipeline or `$(...)` with other commands; capture its output to a file first. A smoke test asserts the healthy result, not just a response.
- **Status:** guarded (the smoke test fails on an unhealthy API)

### L-013 · 2026-11-04 · ci · The first deploy's smoke test failed on CLI output
- **What happened:** the first run of `deploy.yml` deployed correctly and found the access line, then failed in `jq`: `aws logs filter-log-events --output text` printed the message and a second line `None`. Found in CI.
- **Root cause:** the AWS CLI paginates this call by default, and text output prints the queried value once per page. The step was linted but never run, because `workflow_run` workflows only run from `main`.
- **Fix:** follow-up PR to M0-10 queries with `--output json` and picks the first event with `jq`.
- **Prevention:** rule added under "Active rules": parse AWS CLI results as JSON (`--output json` + `jq`), never text output.
- **Status:** documented

### L-012 · 2026-11-04 · infra · The CI roles' trust policies never matched GitHub's OIDC subject
- **What happened:** the first workflow to assume `gainframe-ci-plan` (M0-10) failed with "Not authorized to perform sts:AssumeRoleWithWebIdentity". Decoding the token in the job showed the subject `repo:brianwong0819@59221587/gainframe@1439499232:pull_request`; the trust policies from M0-07 expected `repo:brianwong0819/gainframe:pull_request`. Found in CI.
- **Root cause:** the trust conditions were written from the documented legacy subject format, and M0-07's Verify checked only that the roles existed, not that a workflow could assume them. GitHub sends the immutable form (owner and repository IDs) for this repository.
- **Fix:** PR for M0-10 pins both trust policies to the immutable subject.
- **Prevention:** the plan workflow assumes the plan role on every infrastructure pull request, and the deploy assumes the apply role on every merge, so a trust mismatch now fails a check. Rule added under "Active rules": verify an identity or permission change by exercising it from the real caller, not by reading the resource.
- **Status:** guarded

### L-011 · 2026-11-03 · infra · The dev first-apply steps failed on bw's machine
- **What happened:** following `infra/envs/dev/README.md`, `pnpm build` failed with "Command build not found" and `cd infra/envs/dev` failed, because the terminal was in `C:\Users\brian`. Then `terraform init` and `curl.exe` to CloudFront failed with connection resets over IPv6. Found by bw during the M0-08 apply.
- **Root cause:** the steps said "from the repository root" without a `cd` command, and were checked only in the cloud container (bash, a different network). Nothing covered a provider download failing.
- **Fix:** the README now starts with `cd C:\dev\gainframe` and `git pull`, uses `curl.exe -4`, and documents installing providers with `terraform init "-plugin-dir=..."`; the bootstrap README names its folder.
- **Prevention:** rule added under "Active rules": every command block for bw starts with `cd` to an absolute path and gives the fallback for each download.
- **Status:** documented

### L-010 · 2026-11-03 · infra · A Terraform flag broke in PowerShell
- **What happened:** the M0-07 first-apply steps used `terraform plan -out=bootstrap.tfplan`; in PowerShell it failed with "Too many command line arguments". Found by bw during the apply.
- **Root cause:** PowerShell splits an unquoted argument that starts with `-` at the `.`, so Terraform received two arguments. The steps were checked with bash in the cloud container, not PowerShell.
- **Fix:** PR for M0-07 quotes the argument in `infra/bootstrap/README.md`.
- **Prevention:** rule added under "Active rules": quote `-flag=value.ext` arguments in every PowerShell command given to bw.
- **Status:** documented

### L-009 · 2026-11-02 · process · Plan and code problems surfaced in a batch
- **What happened:** the maintainability review before M0-06 found a dozen issues at once (no logging design, an alarm that could never fire, an ADR number collision, a `.env` deny gap). bw asked for regular, proactive reviews so problems do not pile up until late.
- **Root cause:** reviews were scheduled only at milestone retros; no step in a task checked whether the change affected later ROADMAP tasks.
- **Fix:** PR for M0-06.
- **Prevention:** "Look ahead" step added to the work loop in `CLAUDE.md` and to `/finish-task` (check affected later tasks; whole-repository review at each milestone's midpoint); `/retro` now walks the next milestone's tasks against the current code.
- **Status:** documented

### L-008 · 2026-11-02 · process · A PR shipped from an auto-generated branch name
- **What happened:** the M0-05 PR (#4) used the cloud session's branch `claude/project-thread-8yxg8c`; bw asked why the name was so odd.
- **Root cause:** the session's suggested branch was used instead of the convention in `docs/conventions.md`.
- **Fix:** later work uses `m0/...` branches.
- **Prevention:** rule added under "Active rules"; `/start-task` already creates the branch by convention.
- **Status:** documented

### L-007 · 2026-11-02 · process · Two documents claimed ADR-0001
- **What happened:** ROADMAP M0-13 and `architecture.md` reserved ADR-0001 for sync rules, but M0-03 used ADR-0001 for the AWS account model. Found in the maintainability review.
- **Root cause:** ADR numbers were assigned in the plan before the ADRs existed; writing ADR-0001 did not trigger a search for other references.
- **Fix:** planned ADRs renumbered (sync 0002, PWA 0003, iOS timer 0004) in PR `m0/review-maintainability`.
- **Prevention:** rule added under "Active rules": cite planned ADRs by topic, numbers only once written.
- **Status:** documented

### L-006 · 2026-11-02 · tooling · Claude Code could read `apps/api/.env`
- **What happened:** `.claude/settings.json` denied `Read(./.env)` at the repository root only. M0-05 added `apps/api/.env` (the database URL), which the patterns did not cover. Found in the maintainability review; no secret was read.
- **Root cause:** the deny list was written before the monorepo had per-app env files, and M0-05 did not re-check it.
- **Fix:** patterns changed to `./**/.env` and friends in PR `m0/review-maintainability`.
- **Prevention:** rule added under "Active rules". gitleaks in CI (M0-06) is the automated backstop for anything committed.
- **Status:** documented

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
