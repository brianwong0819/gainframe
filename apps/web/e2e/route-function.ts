/**
 * Runs the site's CloudFront Function (infra/modules/site/route-function.js)
 * in Node, rendered the way Terraform renders it, so the e2e server and the
 * unit tests route requests exactly as CloudFront does.
 */
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'

import { z } from 'zod'

const siteModule = new URL('../../../infra/modules/site/', import.meta.url)

const routeFileSchema = z.object({ pages: z.array(z.string()), devPages: z.array(z.string()) })
const requestSchema = z.object({ uri: z.string() })

/** The exported routes Terraform builds the function with. */
export const siteRoutes = routeFileSchema.parse(
  JSON.parse(readFileSync(new URL('routes.json', siteModule), 'utf8')),
)

/** Returns a function that maps a request path to the object CloudFront fetches. */
export function loadRouteFunction(routes: readonly string[]): (uri: string) => string {
  const source = readFileSync(new URL('route-function.js', siteModule), 'utf8').replace(
    'ROUTE_TABLE',
    JSON.stringify(Object.fromEntries(routes.map((route) => [route, true]))),
  )
  // CloudFront runs the file as a script that defines handler(); so does a fresh VM context.
  return (uri) =>
    requestSchema.parse(
      runInNewContext(`${source}\nhandler(event)`, { event: { request: { uri } } }),
    ).uri
}
