import { domainConfig } from '../config.ts'

// Where a day's protein stands, for the line under the day card's large number
// ("Verdict line" in docs/design-system.md). `early` is before the eating
// window opens, when no pace can be judged yet.
export type ProteinPace =
  | { status: 'met' }
  | { status: 'early' }
  | { status: 'onPace' }
  | { status: 'behind'; expectedG: number }
  | { status: 'missed'; share: number }

// Today's protein against a straight line from nothing at the start of the
// eating window to the target at its end, on the device's clock (`hour` from 0
// to 24, fractions for minutes). A day that is over (`hour` null) either met
// its target or missed it, with the share of the target it reached.
export function proteinPace(eatenG: number, targetG: number, hour: number | null): ProteinPace {
  if (eatenG >= targetG) return { status: 'met' }
  if (hour === null) return { status: 'missed', share: eatenG / targetG }
  const { fromHour, toHour, marginShare } = domainConfig.proteinPace
  if (hour <= fromHour) return { status: 'early' }
  const elapsed = Math.min(1, (hour - fromHour) / (toHour - fromHour))
  const expectedG = targetG * elapsed
  if (eatenG >= expectedG - targetG * marginShare) return { status: 'onPace' }
  return { status: 'behind', expectedG }
}
