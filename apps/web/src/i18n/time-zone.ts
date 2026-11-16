/** The device's IANA time zone: the zone a new row's `localDate` is computed in, and dates are shown in. */
export const deviceTimeZone = (): string => Intl.DateTimeFormat().resolvedOptions().timeZone
