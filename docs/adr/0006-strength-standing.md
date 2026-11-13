# ADR-0006: Strength standing from open powerlifting data

- Status: proposed (accepted when M8-01 starts)
- Date: 2026-11-13

## Context

bw asked for a level shown while training: where the weight a user lifts sits among people of the same sex and body weight. It must look professional and must not mislead. Three questions decide whether this is honest: which data the comparison uses, which exercises it can cover, and what the number means.

There is no open dataset of gym-goers' strength. Published "strength standards" are either proprietary or derived from competitive lifters. No public dataset breaks strength down by country or region at a useful sample size, so a regional comparison is out of reach; sex, body weight and age are the dimensions that data supports.

## Options considered

1. **Licence a commercial standards table (Strength Level)** — covers many exercises and a broader gym population (user-submitted lifts). Its terms forbid copying values into another product, including free apps, without a paid licence, priced well beyond this project's budget. Self-reported data is also unverified.
2. **Transcribe published tables (textbooks, ExRx, Symmetric Strength)** — copyrighted tables with undocumented methods; derived values in another product are the same licence problem.
3. **Use the published norms of van den Hoek et al. (2024)** — peer-reviewed percentiles (P10–P90) of relative strength from 809,986 drug-tested, unequipped competition entries, CC BY 4.0. Coarse: the paper's tables do not give every sex × weight class × age cell we would need.
4. **Derive our own percentile table from OpenPowerlifting** — the data behind option 3 and most others; released into the public domain. A build-time script reduces a dated snapshot to a small table in `packages/shared`. We control the filters, the bands and the minimum cell size, and option 3 serves as the check that the derivation is right.

## Decision

Option 4, checked against option 3. Compare only the back squat, bench press and deadlift, using raw, drug-tested lifters, by sex, body-weight band and age band. Show a percentile with its comparison group, the e1RM it rests on, the data source and a "for reference only" note. No other exercise gets a standing, and there is no regional comparison.

## Consequences

- The comparison group is people who train for and enter powerlifting meets, so it is strong: most gym-goers sit below its median. The UI names the group exactly ("raw tested lifters, 66–74 kg, 18–35") instead of implying "people like you", and avoids level names such as "beginner" or "elite" that would imply a general population.
- Competition lifts follow stricter rules (depth, paused bench) than gym sets, and a gym e1RM from a set of 8 is less reliable than a single. The standing prefers e1RMs from sets of 1–5 reps and says which it used.
- It needs sex, birth year and a recent body weight. These are optional profile fields (M4-01) and body metrics (M4-02); without them the standing is not shown.
- No new runtime dependency or service: the script runs by hand on a downloaded snapshot, and the output is a constant of a few kilobytes. Refreshing it is a deliberate PR with the new snapshot date.
- Overhead press and accessory lifts stay without a standing. Adding them later needs a new open dataset and a new ADR.
- References: OpenPowerlifting FAQ (data in the public domain), https://www.openpowerlifting.org/dist/openipf/faq; van den Hoek DJ et al., "Normative data for the squat, bench press and deadlift exercises in powerlifting: data from 809,986 competition entries", Journal of Science and Medicine in Sport 27(10), 2024, https://ro.ecu.edu.au/ecuworks2022-2026/4617; Strength Level data licensing terms, https://strengthlevel.com/data-licensing.
