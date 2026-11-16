import type { ClientError } from '@gainframe/shared'

/** What the copied report says about the device and build it came from. */
export interface ReportContext {
  release: string
  userAgent: string
  persisted: boolean | null
  copiedAt: string
}

/**
 * The plain-text report Diagnostics copies, for pasting into a chat or an
 * issue: the build and device first, then each error with its stack, newest
 * first. Errors carry the path only, never a query string (see report.ts).
 */
export function formatErrorReport(context: ReportContext, errors: readonly ClientError[]): string {
  const header = [
    `Gainframe diagnostics, ${context.copiedAt}`,
    `Release: ${context.release}`,
    `User agent: ${context.userAgent}`,
    `Storage persisted: ${context.persisted === null ? 'unknown' : String(context.persisted)}`,
    `Errors: ${String(errors.length)}`,
  ]
  const entries = errors.map((error) =>
    [
      `[${error.at}] ${error.source} ${error.route} (release ${error.release})`,
      error.message,
      ...(error.stack === null ? [] : [error.stack]),
    ].join('\n'),
  )
  return [header.join('\n'), ...entries].join('\n\n')
}
