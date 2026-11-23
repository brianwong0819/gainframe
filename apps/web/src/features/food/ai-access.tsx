'use client'

import { tokenAllowsAi } from '@/auth/groups'
import { useTranslations } from 'next-intl'

import { loadSession } from '@/db/auth-session'
import { db } from '@/db/client'
import { useLiveQuery } from '@/db/use-live-query'

// Whether the AI features are open to this device's user: only a signed-in
// member of the AI group ("Who can use AI" in docs/ai.md). The API enforces the
// same rule; the screens grey out the AI entry points for everyone else and
// say how to get them.
export type AiAccess = 'allowed' | 'signedOut' | 'notEnabled'

const readAiAccess = () =>
  loadSession(db).then((session): AiAccess => {
    if (session === null) return 'signedOut'
    return tokenAllowsAi(session.accessToken) ? 'allowed' : 'notEnabled'
  })

// Undefined while the session is read.
export function useAiAccess(): AiAccess | undefined {
  return useLiveQuery(readAiAccess)
}

// The line under a greyed-out AI entry point; a span, since it also sits
// inside a button.
export function AiLockedNote({ access, id }: { access: AiAccess | undefined; id: string }) {
  const t = useTranslations('estimate.locked')
  if (access === undefined || access === 'allowed') return null
  return (
    <span id={id} className="text-label text-ink-3">
      {t(access)}
    </span>
  )
}
