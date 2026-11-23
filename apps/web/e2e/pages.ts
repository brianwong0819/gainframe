// Every page the app has. The dev pages exist only in builds with
// GAINFRAME_DEV_PAGES=1, which CI sets for the e2e job. A page below a tab
// names its parent: it must have a back link there (layout.spec.ts).
export const pages: { name: string; path: string; parent?: string }[] = [
  { name: 'today', path: '/' },
  { name: 'workout', path: '/workout' },
  { name: 'exercises', path: '/workout/exercises', parent: '/workout' },
  { name: 'workout-session', path: '/workout/session', parent: '/workout' },
  { name: 'workout-summary', path: '/workout/summary', parent: '/workout' },
  { name: 'history', path: '/workout/history', parent: '/workout' },
  { name: 'past-workout', path: '/workout/past', parent: '/workout/history' },
  { name: 'plans', path: '/workout/plans', parent: '/workout' },
  { name: 'plan', path: '/workout/plan', parent: '/workout/plans' },
  { name: 'food', path: '/food' },
  { name: 'food-add', path: '/food/add', parent: '/food' },
  { name: 'food-photo', path: '/food/photo', parent: '/food' },
  { name: 'food-describe', path: '/food/describe', parent: '/food/add' },
  { name: 'settings', path: '/settings', parent: '/' },
  { name: 'diagnostics', path: '/settings/diagnostics', parent: '/settings' },
  { name: 'sign-in', path: '/settings/sign-in', parent: '/settings' },
  { name: 'account', path: '/settings/account', parent: '/settings' },
  { name: 'kitchen-sink', path: '/dev/kitchen-sink' },
  { name: 'rest-timer', path: '/dev/rest-timer' },
  { name: 'database', path: '/dev/database' },
]
