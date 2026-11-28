'use client'

import { useTranslations } from 'next-intl'
import { useEffect, useState, useSyncExternalStore } from 'react'

import { type AuthConfig, readAuthConfig } from '@/auth/config'
import {
  clearFinished,
  type FinishedSession,
  readFinished,
  stashFinished,
} from '@/auth/finished-session'
import {
  finishSignIn,
  isSignInRedirect,
  SignInError,
  type SignInFailure,
  type SignInMethod,
  startSignIn,
} from '@/auth/sign-in'
import { loadSession, saveSession } from '@/db/auth-session'
import { db } from '@/db/client'
import { countLocalRecords } from '@/db/local-records'
import { pendingRowCount } from '@/db/sync'
import { useLiveQuery } from '@/db/use-live-query'
import { reportError } from '@/diagnostics/report'
import { Pressable } from '@/ui/pressable'

import { FirstBackup } from './first-backup'
import { useOnline } from './use-online'

const config = readAuthConfig()

// signedIn: the redirect finished at `at`; `uploading` says whether the device
// held changes for the account then, or will download what the account holds.
type Redirect =
  | { step: 'finishing' }
  | { step: 'failed'; failure: SignInFailure }
  | { step: 'signedIn'; uploading: boolean; at: number }
  | null

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

// A healthy write of the session takes milliseconds. Past this, WebKit has left
// the page's IndexedDB transactions pending after the redirect back from
// Google (src/auth/finished-session.ts), and the page reloads to store it.
const STORE_TIMEOUT_MS = 5 * 1000

class StoreTimeout extends Error {
  constructor() {
    super(`storing the session took over ${String(STORE_TIMEOUT_MS)} ms`)
    this.name = 'StoreTimeout'
  }
}

function withTimeout<T>(promise: Promise<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new StoreTimeout())
    }, STORE_TIMEOUT_MS)
    promise.then(resolve, reject).finally(() => {
      clearTimeout(timer)
    })
  })
}

// `uploading`: whether the device held changes for the account before it joined.
async function saveAndCount(finished: FinishedSession): Promise<boolean> {
  const uploading = (await pendingRowCount(db)) > 0
  await saveSession(db, finished.session)
  return uploading
}

function store(finished: FinishedSession) {
  const startedAt = Date.now()
  withTimeout(saveAndCount(finished))
    .then((uploading) => {
      clearFinished()
      // Kept as a measurement of the WebKit hang, not as a failure.
      if (finished.reloadedAt !== null) {
        const hungMs = String(finished.reloadedAt - finished.savedAt)
        reportError(
          'error',
          new Error(`sign-in stored after a reload; IndexedDB hung ${hungMs} ms`),
        )
      }
      setRedirect({ step: 'signedIn', uploading, at: Date.now() })
    })
    .catch((error: unknown) => {
      if (
        error instanceof StoreTimeout &&
        finished.reloadedAt === null &&
        stashFinished({ ...finished, reloadedAt: Date.now() })
      ) {
        window.location.replace(window.location.pathname)
        return
      }
      clearFinished()
      const reason = error instanceof Error ? `${error.name}: ${error.message}` : String(error)
      reportError(
        'unhandledrejection',
        new Error(
          `storing the session failed after ${String(Date.now() - startedAt)} ms: ${reason}`,
          {
            cause: error,
          },
        ),
      )
      setRedirect({ step: 'failed', failure: 'exchange' })
    })
}

function finishRedirect(authConfig: AuthConfig) {
  if (redirectState?.step === 'finishing') return
  const params = new URLSearchParams(window.location.search)
  if (!isSignInRedirect(params)) {
    // The page reloaded to store a session that the previous page could not.
    const finished = readFinished(Date.now())
    if (finished === null) return
    setRedirect({ step: 'finishing' })
    store(finished)
    return
  }
  window.history.replaceState(null, '', window.location.pathname)
  setRedirect({ step: 'finishing' })
  finishSignIn(authConfig, params).then(
    (session) => {
      store({ session, savedAt: Date.now(), reloadedAt: null })
    },
    (error: unknown) => {
      // The accounts were just linked; the second Google sign-in succeeds.
      if (error instanceof SignInError && error.failure === 'linked') {
        startSignIn(authConfig, 'google', true).catch((retryError: unknown) => {
          reportError('unhandledrejection', retryError)
          setRedirect({ step: 'failed', failure: 'linked' })
        })
        return
      }
      // A refused or failed exchange is recorded with what Cognito answered, so
      // Diagnostics shows why; a cancelled sign-in is not an error.
      if (!(error instanceof SignInError) || error.failure === 'exchange') {
        reportError('unhandledrejection', error)
      }
      setRedirect({
        step: 'failed',
        failure: error instanceof SignInError ? error.failure : 'exchange',
      })
    },
  )
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
  if (session !== null && !session.expired && redirect?.step === 'signedIn') {
    return <FirstBackup uploading={redirect.uploading} since={redirect.at} />
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

  const signIn = (method: SignInMethod) => {
    setLeaving(true)
    startSignIn(config, method).catch((error: unknown) => {
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
          onClick={() => {
            signIn('google')
          }}
          disabled={!online || leaving}
          className="flex items-center justify-center gap-12 rounded-ctl bg-ink py-12 text-body font-semibold text-bg disabled:opacity-40"
        >
          {/* Google's mark on a white disc, as its branding rules require (docs/design/credits.md). */}
          <span
            aria-hidden
            className="size-28 rounded-full bg-logo-disc bg-[url(/brand/google-g.svg)] bg-size-[16px] bg-center bg-no-repeat"
          />
          {t('google')}
        </Pressable>
        <Pressable
          onClick={() => {
            signIn('email')
          }}
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
