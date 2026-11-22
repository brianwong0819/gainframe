'use client'

import { useTranslations } from 'next-intl'

import { readAuthConfig } from '@/auth/config'
import { loadSession } from '@/db/auth-session'
import { db } from '@/db/client'
import { useLiveQuery } from '@/db/use-live-query'
import { Chevron } from '@/ui/chevron'
import { PressableLink } from '@/ui/pressable'

const config = readAuthConfig()

// The account row that leads Settings ("Accounts and backup"). Hidden in a
// build without sign-in.
export function AccountRow() {
  const t = useTranslations('settings')
  const session = useLiveQuery(() => loadSession(db))
  if (config === null || session === undefined) return null
  return (
    <PressableLink
      href="/settings/sign-in"
      className="flex items-center justify-between gap-12 rounded-group bg-surface p-16"
    >
      <span className="flex flex-col">
        <span className="text-body text-ink">{t('account')}</span>
        <span className="text-label text-ink-3">
          {session === null ? t('accountHint') : t('accountSignedIn', { email: session.email })}
        </span>
      </span>
      <span className="text-ink-3">
        <Chevron direction="right" />
      </span>
    </PressableLink>
  )
}
