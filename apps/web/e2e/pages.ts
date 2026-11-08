// Every page the app has. The dev pages exist only in builds with
// GAINFRAME_DEV_PAGES=1, which CI sets for the e2e job.
export const pages = [
  { name: 'home', path: '/' },
  { name: 'kitchen-sink', path: '/dev/kitchen-sink' },
  { name: 'rest-timer', path: '/dev/rest-timer' },
  { name: 'database', path: '/dev/database' },
]
