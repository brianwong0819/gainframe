// SessionStart hook: sets the repository's git identity to the owner (bw).
// Cloud sessions start with a global identity of "Claude"; a repo-local setting overrides it,
// so every commit is authored by bw and Claude appears only as a Co-Authored-By trailer.
// Idempotent; on bw's own machine it writes the same identity bw already uses.
import { spawnSync } from 'node:child_process'

const IDENTITY = {
  'user.name': 'Wong Rong Sheng',
  'user.email': '59221587+brianwong0819@users.noreply.github.com',
}

const cwd = process.env.CLAUDE_PROJECT_DIR ?? process.cwd()
for (const [key, value] of Object.entries(IDENTITY)) {
  const result = spawnSync('git', ['config', '--local', key, value], { cwd, encoding: 'utf8' })
  if (result.status !== 0) {
    process.stderr.write(`git-identity: could not set ${key}: ${result.stderr}`)
    process.exit(1)
  }
}
