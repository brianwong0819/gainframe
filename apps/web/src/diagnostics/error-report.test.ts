import { describe, expect, it } from 'vitest'

import { formatErrorReport } from './error-report'

const context = {
  release: 'abc1234',
  userAgent: 'Test/1.0',
  persisted: true,
  copiedAt: '2026-11-16T03:00:00.000Z',
}

describe('formatErrorReport', () => {
  it('lists the build and device, then each error with its stack', () => {
    const report = formatErrorReport(context, [
      {
        source: 'unhandledrejection',
        message: 'Quota exceeded',
        stack: 'Error: Quota exceeded\n    at save (app.js:1:2)',
        route: '/workout/session',
        release: 'abc1234',
        at: '2026-11-16T02:59:00.000Z',
      },
      {
        source: 'boundary',
        message: 'Cannot read properties of undefined',
        stack: null,
        route: '/',
        release: 'old5678',
        at: '2026-11-15T10:00:00.000Z',
      },
    ])
    expect(report).toBe(
      [
        'Gainframe diagnostics, 2026-11-16T03:00:00.000Z',
        'Release: abc1234',
        'User agent: Test/1.0',
        'Storage persisted: true',
        'Errors: 2',
        '',
        '[2026-11-16T02:59:00.000Z] unhandledrejection /workout/session (release abc1234)',
        'Quota exceeded',
        'Error: Quota exceeded',
        '    at save (app.js:1:2)',
        '',
        '[2026-11-15T10:00:00.000Z] boundary / (release old5678)',
        'Cannot read properties of undefined',
      ].join('\n'),
    )
  })

  it('says when persistence is unknown and there are no errors', () => {
    expect(formatErrorReport({ ...context, persisted: null }, [])).toBe(
      [
        'Gainframe diagnostics, 2026-11-16T03:00:00.000Z',
        'Release: abc1234',
        'User agent: Test/1.0',
        'Storage persisted: unknown',
        'Errors: 0',
      ].join('\n'),
    )
  })
})
