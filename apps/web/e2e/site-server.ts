/**
 * Serves the static export in `out/` the way CloudFront serves it from S3:
 * paths go through the same route function, and responses carry CloudFront's
 * Content-Security-Policy header. `serve.ts` runs it for every spec;
 * `offline.spec.ts` starts its own copy so it can take it down.
 */
import { readFileSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { createServer, type Server } from 'node:http'
import { extname, join, normalize } from 'node:path'

import { loadRouteFunction, siteRoutes } from './route-function.ts'

const root = join(import.meta.dirname, '..', 'out')

// The policy text the CloudFront response headers policy is built from.
const contentSecurityPolicy = readFileSync(
  new URL('../../../infra/modules/site/content-security-policy.txt', import.meta.url),
  'utf8',
)
  .split('\n')
  .map((line) => line.trim())
  .filter((line) => line !== '')
  .join('; ')

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

// The e2e build includes the developer pages (GAINFRAME_DEV_PAGES=1).
const route = loadRouteFunction([...siteRoutes.pages, ...siteRoutes.devPages])

async function load(pathname: string): Promise<{ body: Buffer; file: string } | undefined> {
  const file = normalize(join(root, decodeURIComponent(route(pathname))))
  if (!file.startsWith(root)) return undefined
  try {
    return { body: await readFile(file), file }
  } catch {
    // S3 answers a missing object with an error, not a page.
    return undefined
  }
}

/** A server for the static export; the caller decides when to listen and close. */
export function createSiteServer(): Server {
  return createServer((request, response) => {
    const { pathname } = new URL(request.url ?? '/', 'http://localhost')
    void load(pathname).then((found) => {
      if (!found) {
        response.writeHead(404).end()
        return
      }
      response
        .writeHead(200, {
          'content-type': types[extname(found.file)] ?? 'application/octet-stream',
          'content-security-policy': contentSecurityPolicy,
        })
        .end(found.body)
    })
  })
}
