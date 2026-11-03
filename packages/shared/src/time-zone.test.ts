import { describe, expect, it } from 'vitest'

// Guards the test environment itself: if TZ stops being applied, date bugs that
// only show at negative offsets would pass silently again.
describe('test environment', () => {
  it('runs in America/Los_Angeles', () => {
    expect(Intl.DateTimeFormat().resolvedOptions().timeZone).toBe('America/Los_Angeles')
  })

  it('observes daylight saving (UTC-8 in January, UTC-7 in July)', () => {
    expect(new Date('2026-01-15T12:00:00Z').getTimezoneOffset()).toBe(480)
    expect(new Date('2026-07-15T12:00:00Z').getTimezoneOffset()).toBe(420)
  })
})
