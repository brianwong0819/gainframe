'use client'

import { useTranslations } from 'next-intl'
import { useState } from 'react'

import { Pressable, PressableLink } from '@/ui/pressable'

import { BackupAction, BackupText, useLastBackupText } from './backup-summary'
import { SignOutSheet } from './sign-out-sheet'
import { useBackup } from './use-backup'

// The account page ("Accounts and backup"): the email, a backup card with the
// same words and action as the backup sheet, and sign out. Deleting the account
// joins it with M2-10.
export function Account() {
  const t = useTranslations('account')
  const backup = useBackup()
  const last = useLastBackupText(backup?.lastSyncAt ?? null)
  const [signingOut, setSigningOut] = useState(false)
  if (backup === undefined) return null
  if (backup.state === 'signedOut' || backup.email === null) {
    return (
      <PressableLink
        href="/settings/sign-in"
        className="rounded-ctl bg-sunk py-12 text-center text-body font-semibold text-ink"
      >
        {t('signIn')}
      </PressableLink>
    )
  }
  return (
    <>
      <section className="rounded-group bg-surface p-16">
        <p className="truncate text-body font-semibold text-ink">{backup.email}</p>
      </section>
      <section className="flex flex-col gap-12 rounded-group bg-surface p-16">
        <h2 className="text-label text-ink-3">{t('backup')}</h2>
        <BackupText backup={backup} />
        <div className="flex items-baseline justify-between gap-12 border-t border-line pt-12">
          <span className="text-label text-ink-2">{t('lastBackup')}</span>
          <span className="num text-label text-ink">{last}</span>
        </div>
        <BackupAction backup={backup} tone="sunk" />
      </section>
      <Pressable
        onClick={() => {
          setSigningOut(true)
        }}
        className="rounded-group bg-surface p-16 text-left text-body text-ink"
      >
        {t('signOut')}
      </Pressable>
      <SignOutSheet
        backup={backup}
        open={signingOut}
        onClose={() => {
          setSigningOut(false)
        }}
      />
    </>
  )
}
