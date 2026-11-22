'use client'

import { useTranslations } from 'next-intl'
import { useState } from 'react'

import type { BackupState } from '@/sync/view'
import { Pressable } from '@/ui/pressable'
import { Sheet } from '@/ui/sheet'

import { BackupAction, BackupFacts, BackupText } from './backup-summary'
import { type Backup, useBackup } from './use-backup'

// The mark drawn inside the cloud for each state.
const marks: Record<Exclude<BackupState, 'signedOut'>, string> = {
  ok: 'M9.6 13.6l1.8 1.8 3.2-3.6',
  busy: 'M12 16v-4.6m-2 1.9l2-2 2 2',
  offline: 'M4 4l16 17',
  retry: 'M12 11v2.8M12 16v.1',
  expired: 'M12 11v2.8M12 16v.1',
  update: 'M12 11v2.8M12 16v.1',
}

function BackupIcon({ state }: { state: Exclude<BackupState, 'signedOut'> }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M7 18a4.5 4.5 0 0 1-.6-8.96A6 6 0 0 1 18 10.5a3.75 3.75 0 0 1-.5 7.5H7z" />
      <path d={marks[state]} />
    </svg>
  )
}

function BackupSheet({
  backup,
  open,
  onClose,
}: {
  backup: Backup
  open: boolean
  onClose: () => void
}) {
  const t = useTranslations('backup')
  return (
    <Sheet open={open} onClose={onClose} title={t('sheetTitle')} closeLabel={t('close')}>
      <div className="flex flex-col gap-16">
        <BackupText backup={backup} />
        <BackupFacts backup={backup} />
        <BackupAction backup={backup} tone="ink" />
      </div>
    </Sheet>
  )
}

// The cloud beside Today's settings gear, shown only when signed in. Quiet
// states are `--ink-2`; a state worth a look is `--ink`. Offline shows how many
// changes wait beside it.
export function BackupStatus() {
  const t = useTranslations('backup')
  const backup = useBackup()
  const [open, setOpen] = useState(false)
  if (backup === undefined || backup.state === 'signedOut') return null
  const quiet = backup.state === 'ok' || backup.state === 'offline'
  return (
    <>
      <Pressable
        aria-label={t('statusLabel')}
        onClick={() => {
          setOpen(true)
        }}
        className={`-my-12 flex items-center gap-4 rounded-ctl p-12 ${quiet ? 'text-ink-2' : 'text-ink'}`}
        data-backup-state={backup.state}
      >
        <BackupIcon state={backup.state} />
        {backup.state === 'offline' && backup.pending > 0 && (
          <span className="num text-label font-semibold">{backup.pending}</span>
        )}
      </Pressable>
      <BackupSheet
        backup={backup}
        open={open}
        onClose={() => {
          setOpen(false)
        }}
      />
    </>
  )
}

// The card that leads Today when backup needs the user: the session expired,
// the app is too old for the server, or backups have failed for a day.
export function BackupCard() {
  const backup = useBackup()
  if (backup?.needsUser !== true) return null
  return (
    <section className="flex flex-col gap-12 rounded-group border border-ink bg-surface p-16">
      <BackupText backup={backup} />
      <BackupAction backup={backup} tone="ink" />
    </section>
  )
}
