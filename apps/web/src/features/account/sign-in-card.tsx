'use client'

import { useTranslations } from 'next-intl'

import { readAuthConfig } from '@/auth/config'
import { loadSession } from '@/db/auth-session'
import { db } from '@/db/client'
import { countLocalRecords } from '@/db/local-records'
import { useLiveQuery } from '@/db/use-live-query'
import { Pressable, PressableLink } from '@/ui/pressable'

const config = readAuthConfig()
const DISMISSED = 'signInCardDismissed'

const loadSignedIn = async () => (await loadSession(db)) !== null
const loadCounts = () => countLocalRecords(db)
const loadDismissed = async () => (await db.settings.get(DISMISSED)) !== undefined

// The one-line card at the end of Today ("Accounts and backup"): shown signed
// out once the device holds a finished workout, until signed in or dismissed;
// a dismissal is for good.
export function SignInCard() {
  const t = useTranslations('account')
  const signedIn = useLiveQuery(loadSignedIn)
  const counts = useLiveQuery(loadCounts)
  const dismissed = useLiveQuery(loadDismissed)
  if (config === null || signedIn !== false || dismissed !== false || counts === undefined) {
    return null
  }
  if (counts.workouts === 0) return null
  return (
    <section className="flex items-center gap-12 rounded-group bg-surface py-4 pl-16 pr-4">
      <p className="min-w-0 flex-1 text-label text-ink-2">
        {t('cardText', { workouts: counts.workouts })}
      </p>
      <PressableLink
        href="/settings/sign-in"
        className="shrink-0 rounded-ctl px-12 py-12 text-label font-semibold text-ink"
      >
        {t('signIn')}
      </PressableLink>
      <Pressable
        aria-label={t('dismiss')}
        onClick={() => {
          void db.settings.put({ key: DISMISSED, value: 'true' })
        }}
        className="shrink-0 rounded-ctl p-12 text-ink-3"
      >
        <svg
          viewBox="0 0 24 24"
          aria-hidden
          className="size-20 fill-none stroke-current"
          strokeWidth={1.75}
          strokeLinecap="round"
        >
          <path d="M6 6l12 12M18 6 6 18" />
        </svg>
      </Pressable>
    </section>
  )
}
