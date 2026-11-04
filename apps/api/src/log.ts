// JSON-lines logger: one object per line on stdout, which CloudWatch Logs
// Insights parses without configuration. Design: "Observability" in
// docs/architecture.md.

// Primitive values only, so a request, header or body object cannot be logged whole.
export type LogFields = Readonly<Record<string, string | number | boolean | null>>

type Level = 'info' | 'warn' | 'error'

export interface Logger {
  info: (msg: string, fields?: LogFields) => void
  warn: (msg: string, fields?: LogFields) => void
  error: (msg: string, fields?: LogFields) => void
  // A logger that adds `fields` (e.g. the request ID) to every line.
  child: (fields: LogFields) => Logger
}

interface LoggerOptions {
  release: string
  // Tests pass a function that collects lines; the default writes to stdout.
  write?: (line: string) => void
}

export function createLogger({ release, write }: LoggerOptions): Logger {
  return bind(write ?? ((line) => process.stdout.write(line)), { release })
}

function bind(write: (line: string) => void, context: LogFields): Logger {
  const emit = (level: Level, msg: string, fields: LogFields = {}) => {
    // Key order: level and msg first for readability; `context` and the fixed
    // keys are applied last so call-site fields cannot overwrite them.
    const line = Object.assign({ level, msg }, fields, context, { level, msg })
    write(`${JSON.stringify(line)}\n`)
  }
  return {
    info: (msg, fields) => {
      emit('info', msg, fields)
    },
    warn: (msg, fields) => {
      emit('warn', msg, fields)
    },
    error: (msg, fields) => {
      emit('error', msg, fields)
    },
    child: (fields) => bind(write, { ...context, ...fields }),
  }
}

// The fields to log for a caught error: its name, message and stack, never the object.
export function errorFields(error: unknown): LogFields {
  if (error instanceof Error) {
    return { errorName: error.name, errorMessage: error.message, stack: error.stack ?? null }
  }
  return { errorName: typeof error, errorMessage: String(error), stack: null }
}
