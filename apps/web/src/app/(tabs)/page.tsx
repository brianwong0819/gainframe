'use client'

import { domainConfig, recentRecords, summarizeWeek } from '@gainframe/shared'
import { useLocale, useTranslations } from 'next-intl'
import Link from 'next/link'

import { BackupCard, BackupStatus } from '@/features/account/backup-status'
import { formatDay } from '@/features/history/dates'
import { SettingsLink } from '@/features/settings/settings-link'
import { NextWorkout, useWorkoutOverview } from '@/features/workout/next-workout'
import { RecentRecords } from '@/features/workout/recent-records'
import { WeekCard } from '@/features/workout/week-card'
import { UpdatePrompt } from '@/pwa/update-prompt'

import { TabScreen } from './tab-screen'

// Dev builds only; English because these are developer tools outside the i18n
// catalogues (see next.config.ts).
const devPages = [
  { href: '/dev/rest-timer', label: 'Rest timer test' },
  { href: '/dev/kitchen-sink', label: 'Kitchen sink' },
  { href: '/dev/database', label: 'Local database' },
  { href: '/dev/sign-in-probe', label: 'Sign-in redirect test' },
] as const

// Until food logging (M3) and body weight (M4) add their cards, Today is the
// training day: the workout to do now, this week, and the latest records.
export default function TodayPage() {
  const t = useTranslations('today')
  const locale = useLocale()
  const overview = useWorkoutOverview()
  return (
    <TabScreen
      title={t('title')}
      subtitle={overview && formatDay(overview.today, locale)}
      action={
        <div className="flex items-center gap-4">
          <BackupStatus />
          <SettingsLink />
        </div>
      }
    >
      <BackupCard />
      <UpdatePrompt />
      {overview && (
        <>
          <NextWorkout overview={overview} />
          {overview.history.length === 0 ? (
            <p className="text-body text-ink-2">{t('empty')}</p>
          ) : (
            <WeekCard
              week={summarizeWeek(overview.history, overview.today)}
              today={overview.today}
            />
          )}
          <RecentRecords
            records={recentRecords(overview.history, domainConfig.recentRecords)}
            custom={overview.custom}
          />
        </>
      )}
      {process.env.NEXT_PUBLIC_DEV_PAGES === '1' && (
        <nav aria-label="Dev pages" className="flex flex-col">
          {devPages.map((page) => (
            <Link key={page.href} href={page.href} className="py-12 text-body text-accent">
              {page.label}
            </Link>
          ))}
        </nav>
      )}
    </TabScreen>
  )
}
