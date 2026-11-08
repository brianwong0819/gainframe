import { z } from 'zod'

// Next.js runs this file before the app's own client code.
//
// Every z.object() probes for `new Function` when it is created, to decide whether
// to compile a fast parser. The Content-Security-Policy blocks eval, so the probe
// fails and the browser reports a violation (e2e/csp.spec.ts). Jitless mode skips
// the probe; it has to be set before any module that builds a schema is evaluated.
z.config({ jitless: true })
