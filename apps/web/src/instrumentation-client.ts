// Next.js runs this file before the app's own client code.
// zod-config must stay the first import: later imports build schemas.
import './zod-config'

import { reportError } from './diagnostics/report'

// Errors no error boundary catches: event handlers, timers, failed promises.
// Registered here so errors during the app's own start-up are recorded too.
window.addEventListener('error', (event) => {
  reportError('error', event.error ?? event.message)
})
window.addEventListener('unhandledrejection', (event) => {
  reportError('unhandledrejection', event.reason)
})
