import { readdirSync } from 'node:fs'
import { basename, dirname, sep } from 'node:path'

import { describe, expect, it } from 'vitest'

import { loadRouteFunction, siteRoutes } from '../../e2e/route-function.ts'

// Keeps infra/modules/site/routes.json in step with the pages, and checks the
// CloudFront Function that maps clean URLs to the exported files.

const appDir = import.meta.dirname

/** Every route the static export writes, from the page files under src/app; route groups such as `(tabs)` add no path segment. */
function exportedRoutes(page: 'page.tsx' | 'page.dev.tsx'): string[] {
  return readdirSync(appDir, { recursive: true, encoding: 'utf8' })
    .filter((file) => basename(file) === page)
    .map(
      (file) =>
        `/${dirname(file)
          .split(sep)
          .filter((segment) => segment !== '.' && !/^\(.+\)$/.test(segment))
          .join('/')}`,
    )
    .sort()
}

describe('site routes', () => {
  it('lists every exported page in routes.json', () => {
    expect([...siteRoutes.pages].sort()).toEqual(exportedRoutes('page.tsx'))
    expect([...siteRoutes.devPages].sort()).toEqual(exportedRoutes('page.dev.tsx'))
  })
})

describe('route function', () => {
  const route = loadRouteFunction(['/workout', '/dev/database'])

  it('serves the home page for the root', () => {
    expect(route('/')).toBe('/index.html')
  })

  it('maps a known route to its exported file, with or without a trailing slash', () => {
    expect(route('/workout')).toBe('/workout.html')
    expect(route('/workout/')).toBe('/workout.html')
    expect(route('/dev/database')).toBe('/dev/database.html')
  })

  it('passes file requests through unchanged', () => {
    expect(route('/_next/static/chunks/app.js')).toBe('/_next/static/chunks/app.js')
    expect(route('/workout.txt')).toBe('/workout.txt')
    expect(route('/sw.js')).toBe('/sw.js')
  })

  it('serves 404.html for an unknown route', () => {
    expect(route('/nope')).toBe('/404.html')
    expect(route('/workout/extra')).toBe('/404.html')
  })

  it('does not route a page that was left out of the table', () => {
    expect(loadRouteFunction([])('/dev/database')).toBe('/404.html')
  })
})
