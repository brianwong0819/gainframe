'use client'

import { motion, useReducedMotion } from 'motion/react'
import { useLocale, useTranslations } from 'next-intl'

import { db } from '@/db/client'
import { countAccountRecords } from '@/db/local-records'
import { useLiveQuery } from '@/db/use-live-query'
import { reducedFade, soft } from '@/ui/motion'
import { PressableLink } from '@/ui/pressable'
import { RollingNumber } from '@/ui/rolling-number'

import { BackupText } from './backup-summary'
import { useBackup } from './use-backup'

const loadCounts = () => countAccountRecords(db)

type Counts = Awaited<ReturnType<typeof countAccountRecords>>

// What the account holds, naming only the kinds it has ("12 workouts and 3 plans").
function useHolds(counts: Counts | undefined): { text: string; empty: boolean } {
  const t = useTranslations('firstBackup')
  const locale = useLocale()
  if (counts === undefined) return { text: '', empty: true }
  const held = [
    ['workouts', counts.backedUpWorkouts],
    ['plans', counts.plans],
    ['exercises', counts.exercises],
  ] as const
  const parts = held.filter(([, count]) => count > 0).map(([kind, count]) => t(kind, { count }))
  if (parts.length === 0) return { text: t('holdsNothing'), empty: true }
  const list = new Intl.ListFormat(locale, { type: 'conjunction' }).format(parts)
  return { text: t('holds', { list }), empty: false }
}

// The screen after the first sign-in on a device ("Accounts and backup",
// M2-06): the account, the upload of what the device holds as a rolling count
// over a bar, or the download when the device held nothing, and then what the
// account holds. The backup runs on its own; "Use the app now" leaves it running.
// `since` is when the sign-in finished: only a backup that ended after it counts.
export function FirstBackup({ uploading, since }: { uploading: boolean; since: number }) {
  const t = useTranslations('firstBackup')
  const backup = useBackup()
  const counts = useLiveQuery(loadCounts)
  const reduced = useReducedMotion() === true
  const holds = useHolds(counts)
  if (backup === undefined || counts === undefined) return null

  const done =
    backup.state === 'ok' && backup.lastSyncAt !== null && Date.parse(backup.lastSyncAt) >= since
  // Offline, failing, or needing the user: the backup status says why it waits.
  const stalled = backup.state !== 'ok' && backup.state !== 'busy'
  const showCount = uploading && counts.workouts > 0
  const share = counts.workouts === 0 ? 0 : counts.backedUpWorkouts / counts.workouts

  return (
    <>
      <section className="flex flex-col gap-4 rounded-group bg-surface p-16" aria-live="polite">
        <p className="text-label text-ink-2">{t('account')}</p>
        <p className="truncate text-body font-semibold text-ink">{backup.email}</p>
      </section>
      <section className="flex flex-col gap-12 rounded-group bg-surface p-16" aria-live="polite">
        {done ? (
          <div className="flex flex-col gap-4">
            <p className="text-section">
              {uploading ? t('uploaded') : holds.empty ? t('ready') : t('downloaded')}
            </p>
            <p className="text-body text-ink-2">{holds.text}</p>
            <p className="text-body text-ink-2">{t('automatic')}</p>
          </div>
        ) : (
          <>
            {showCount ? (
              <p className="flex items-baseline gap-8">
                <span className="num text-title text-ink">
                  <RollingNumber
                    value={`${String(counts.backedUpWorkouts)} / ${String(counts.workouts)}`}
                  />
                </span>
                <span className="text-label text-ink-2">{t('workoutsUnit')}</span>
              </p>
            ) : (
              <p className="text-section">
                {uploading ? t('uploading') : t('downloading', { workouts: counts.workouts })}
              </p>
            )}
            {showCount && (
              <div className="h-4 overflow-hidden rounded-full bg-sunk" aria-hidden>
                <motion.div
                  className="h-full origin-left rounded-full bg-ink"
                  initial={false}
                  animate={{ scaleX: share }}
                  transition={reduced ? reducedFade : soft}
                />
              </div>
            )}
            {stalled ? (
              <BackupText backup={backup} />
            ) : (
              <p className="text-body text-ink-2">{t('background')}</p>
            )}
          </>
        )}
      </section>
      <PressableLink
        href="/"
        className={`rounded-ctl py-12 text-center text-body font-semibold ${done ? 'bg-ink text-bg' : 'bg-sunk text-ink'}`}
      >
        {done ? t('start') : t('useNow')}
      </PressableLink>
    </>
  )
}
