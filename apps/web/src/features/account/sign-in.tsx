'use client'

import { useTranslations } from 'next-intl'
import { useEffect, useState, useSyncExternalStore } from 'react'

import { type AuthConfig, readAuthConfig } from '@/auth/config'
import {
  finishSignIn,
  isSignInRedirect,
  SignInError,
  type SignInFailure,
  startSignIn,
} from '@/auth/sign-in'
import { loadSession, saveSession } from '@/db/auth-session'
import { db } from '@/db/client'
import { countLocalRecords } from '@/db/local-records'
import { useLiveQuery } from '@/db/use-live-query'
import { reportError } from '@/diagnostics/report'
import { Pressable } from '@/ui/pressable'

import { useOnline } from './use-online'

const config = readAuthConfig()

type Redirect = { step: 'finishing' } | { step: 'failed'; failure: SignInFailure } | null

// Cognito's redirect back, finished once per arrival: React may run an effect
// twice, and a second exchange of the same code would fail. Kept outside React
// so the page shows the same state however often it mounts.
let redirectState: Redirect = null
const redirectSnapshot = () => redirectState
const redirectListeners = new Set<() => void>()

function setRedirect(next: Redirect) {
  redirectState = next
  for (const listener of redirectListeners) listener()
}

function subscribeRedirect(listener: () => void) {
  redirectListeners.add(listener)
  return () => redirectListeners.delete(listener)
}

function finishRedirect(authConfig: AuthConfig) {
  const params = new URLSearchParams(window.location.search)
  if (redirectState?.step === 'finishing' || !isSignInRedirect(params)) return
  window.history.replaceState(null, '', window.location.pathname)
  setRedirect({ step: 'finishing' })
  finishSignIn(authConfig, params)
    .then((session) => saveSession(db, session))
    .then(() => {
      setRedirect(null)
    })
    .catch((error: unknown) => {
      if (!(error instanceof SignInError)) reportError('unhandledrejection', error)
      setRedirect({
        step: 'failed',
        failure: error instanceof SignInError ? error.failure : 'exchange',
      })
    })
}

// What is at stake, in numbers: the records that exist only on this device.
function stakeText(
  t: ReturnType<typeof useTranslations<'signIn'>>,
  counts: { workouts: number; plans: number } | undefined,
) {
  if (counts === undefined || (counts.workouts === 0 && counts.plans === 0)) return t('stakeEmpty')
  if (counts.plans === 0) return t('stakeWorkouts', counts)
  if (counts.workouts === 0) return t('stakePlans', counts)
  return t('stakeBoth', counts)
}

// The sign-in page (docs/design-system.md, "Accounts and backup"). Cognito's
// redirect back also lands here (ADR-0007).
export function SignIn() {
  const t = useTranslations('signIn')
  const session = useLiveQuery(() => loadSession(db))
  const counts = useLiveQuery(() => countLocalRecords(db))
  const online = useOnline()
  const redirect = useSyncExternalStore(subscribeRedirect, redirectSnapshot, () => null)
  const [leaving, setLeaving] = useState(false)

  useEffect(() => {
    if (config !== null) finishRedirect(config)
  }, [])

  if (config === null) {
    return <p className="text-body text-ink-2">{t('unavailable')}</p>
  }
  if (redirect?.step === 'finishing' || session === undefined) {
    return (
      <p className="text-body text-ink-2" aria-live="polite">
        {redirect === null ? null : t('finishing')}
      </p>
    )
  }
  // An expired session signs in again here; the account and its changes stay.
  if (session !== null && !session.expired) {
    return (
      <section className="flex flex-col gap-4 rounded-group bg-surface p-16" aria-live="polite">
        <p className="text-body text-ink">{t('signedIn')}</p>
        <p className="text-label text-ink-2">{session.email}</p>
      </section>
    )
  }

  const signIn = () => {
    setLeaving(true)
    startSignIn(config).catch((error: unknown) => {
      setLeaving(false)
      reportError('unhandledrejection', error)
    })
  }

  return (
    <>
      {redirect?.step === 'failed' && (
        <p className="rounded-group bg-surface p-16 text-label text-ink" role="alert">
          {t(`failed.${redirect.failure}`)}
        </p>
      )}
      <section className="flex flex-col gap-8 rounded-group bg-surface p-16">
        <p className="text-body text-ink">{stakeText(t, counts)}</p>
        <p className="text-label text-ink-2">{t('benefit')}</p>
      </section>
      <section className="flex flex-col gap-12">
        <Pressable
          onClick={signIn}
          disabled={!online || leaving}
          className="rounded-ctl bg-sunk py-12 text-body font-semibold text-ink disabled:opacity-40"
        >
          {t('email')}
        </Pressable>
        <p className="text-center text-label text-ink-3">{online ? t('optional') : t('offline')}</p>
      </section>
    </>
  )
}
