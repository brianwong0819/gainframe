# Claude Code tooling

Only what clearly pays for itself. Every plugin and MCP server adds tool definitions to every request (tokens), so less is better. Revisit at each milestone retro.

## Install now (M0-02)

| Tool | What it does for us | Install |
|---|---|---|
| **context7** (MCP) | Pulls current, version-specific docs for Next.js, Tailwind, Motion, Dexie, Drizzle, Hono, Zod, Terraform… Biggest single fix for "AI wrote an API that doesn't exist". Free; works without a key, free key raises rate limits. | `claude mcp add --scope user context7 -- npx -y @upstash/context7-mcp` (optional key: add `--api-key ctx7sk-…` from context7.com/dashboard) |
| **gh** CLI | Claude opens PRs, reads CI logs, creates issues from ROADMAP | `winget install --id GitHub.cli` then `gh auth login` |
| **code-review** plugin | Multi-agent review of a diff; run before every PR (`/finish-task` calls it) | `/plugin install code-review@claude-plugins-official` |
| **security-guidance** plugin | Warns while editing about injection, XSS, secrets in code | `/plugin install security-guidance@claude-plugins-official` |

## Install when the milestone needs it

| When | Tool | Why | Install |
|---|---|---|---|
| M0-11 (first UI) | **playwright** plugin / MCP | Claude opens the app at iPhone size, clicks through it and screenshots light/dark — lets it check its own UI work | `/plugin install playwright@claude-plugins-official` |
| M0-04 (first TS code) | **typescript-lsp** plugin | Real type errors and go-to-definition instead of guessing | `npm i -g typescript typescript-language-server` then `/plugin install typescript-lsp@claude-plugins-official` |
| M0-07 (Terraform) — optional | **HashiCorp Terraform MCP** | Exact AWS provider resource docs. Skip if context7 is enough. | see github.com/hashicorp/terraform-mcp-server |
| M2-09 and M7-06 | **Strix** | AI pentest agents that actually attack your running app and prove findings. Needs Docker and an LLM API key; a run can cost several dollars in tokens, so use it twice, not every PR. Only against our own dev environment. | `npx skills add usestrix/strix` (skills), CLI per its README |

## Built in — no install

`/security-review` (security pass on the branch), `/init`, `/compact`, `/clear`, `/model`, `/usage`, plan mode (Shift+Tab).

## Project skills in this repo (`.claude/skills/`)

- `/start-task` — read STATUS + ROADMAP + lessons, branch, post a plan.
- `/finish-task` — run checks, self-review, record lessons, update ROADMAP/STATUS, open PR.
- `/retro` — end-of-milestone retro: promote/prune rules.

## Considered and skipped

- **frontend-design** plugin: pushes its own aesthetic; we already have a strict design system, and two sets of taste rules fight each other.
- **AWS MCP servers with account credentials**: giving the agent live AWS access contradicts "CI applies". Docs-only AWS MCP is fine if context7 falls short.
- Large community "skill packs" and multi-agent frameworks: many overlapping rules, high token cost, conflict with CLAUDE.md.
