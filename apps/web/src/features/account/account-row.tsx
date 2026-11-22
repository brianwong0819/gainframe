'use client'

import { useTranslations } from 'next-intl'

import { readAuthConfig } from '@/auth/config'
import { Chevron } from '@/ui/chevron'
import { PressableLink } from '@/ui/pressable'

import { useBackup } from './use-backup'

const config = readAuthConfig()

// The account row that leads Settings ("Accounts and backup"): signed out it
// leads to sign-in, signed in to the account page with the backup state under
// the email. Hidden in a build without sign-in.
export function AccountRow() {
  const t = useTranslations('settings')
  const tBackup = useTranslations('backup')
  const backup = useBackup()
  if (config === null || backup === undefined) return null
  const signedIn = backup.state !== 'signedOut' && backup.email !== null
  const backupTitle = {
    signedOut: '',
    ok: tBackup('ok.title'),
    busy: tBackup('busy.title', { count: backup.pending }),
    offline: tBackup('offline.title'),
    retry: tBackup('retry.title'),
    expired: tBackup('expired.title'),
    update: tBackup('update.title'),
  }[backup.state]
  return (
    <PressableLink
      href={signedIn ? '/settings/account' : '/settings/sign-in'}
      className="flex items-center justify-between gap-12 rounded-group bg-surface p-16"
    >
      <span className="flex min-w-0 flex-col">
        <span className="truncate text-body text-ink">
          {signedIn ? backup.email : t('account')}
        </span>
        <span className="text-label text-ink-3">{signedIn ? backupTitle : t('accountHint')}</span>
      </span>
      <span className="text-ink-3">
        <Chevron direction="right" />
      </span>
    </PressableLink>
  )
}
