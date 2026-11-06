/**
 * Serves the static export in `out/` for the Playwright tests, the way
 * CloudFront serves it from S3: `/x` falls back to `/x.html`, then `/x/index.html`.
 */
import { readFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import { extname, join, normalize } from 'node:path'

const root = join(import.meta.dirname, '..', 'out')
const port = Number(process.env.PORT ?? '4173')

const types: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
}

async function load(pathname: string): Promise<{ body: Buffer; file: string } | undefined> {
  const base = normalize(join(root, decodeURIComponent(pathname)))
  if (!base.startsWith(root)) return undefined
  for (const file of [base, `${base}.html`, join(base, 'index.html')]) {
    try {
      return { body: await readFile(file), file }
    } catch {
      // Not this candidate; try the next one.
    }
  }
  return undefined
}

createServer((request, response) => {
  const { pathname } = new URL(request.url ?? '/', 'http://localhost')
  void load(pathname).then((found) => {
    if (!found) {
      response.writeHead(404).end()
      return
    }
    response
      .writeHead(200, { 'content-type': types[extname(found.file)] ?? 'application/octet-stream' })
      .end(found.body)
  })
}).listen(port)
