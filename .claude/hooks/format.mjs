// PostToolUse hook: formats and lints the file Claude just edited.
// Runs the workspace's own Prettier and ESLint through Node so it works on Windows without a shell.
// Exit code 2 sends remaining ESLint errors back to Claude to fix.
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { extname, join } from 'node:path'

const PRETTIER_EXTENSIONS = new Set([
  '.js',
  '.mjs',
  '.cjs',
  '.ts',
  '.tsx',
  '.json',
  '.css',
  '.yaml',
  '.yml',
])
const ESLINT_EXTENSIONS = new Set(['.js', '.mjs', '.cjs', '.ts', '.tsx'])

const root = process.env.CLAUDE_PROJECT_DIR ?? process.cwd()
/** @type {unknown} */
const input = JSON.parse(readFileSync(0, 'utf8'))
const toolInput =
  typeof input === 'object' && input !== null && 'tool_input' in input ? input.tool_input : null
const filePath =
  typeof toolInput === 'object' && toolInput !== null && 'file_path' in toolInput
    ? toolInput.file_path
    : null

if (typeof filePath !== 'string' || !existsSync(filePath) || filePath.includes('node_modules')) {
  process.exit(0)
}

const ext = extname(filePath)
/** @param {string} bin @param {string[]} args */
const run = (bin, args) =>
  spawnSync(process.execPath, [join(root, 'node_modules', bin), ...args], {
    cwd: root,
    encoding: 'utf8',
  })

if (PRETTIER_EXTENSIONS.has(ext)) {
  run('prettier/bin/prettier.cjs', ['--write', '--ignore-unknown', '--log-level', 'warn', filePath])
}

if (ESLINT_EXTENSIONS.has(ext)) {
  const result = run('eslint/bin/eslint.js', ['--fix', '--no-warn-ignored', filePath])
  if (result.status !== 0) {
    process.stderr.write(result.stdout + result.stderr)
    process.exit(2)
  }
}
