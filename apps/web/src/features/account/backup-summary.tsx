'use client'

import { useLocale, useTranslations } from 'next-intl'
import { useState, useSyncExternalStore } from 'react'

import { appUpdate } from '@/pwa/update'
import { Pressable, PressableLink } from '@/ui/pressable'

import { type Backup, backUpNow } from './use-backup'

const notWaiting = () => false

// The state's title and sentence ("Accounts and backup": the same words in the
// sheet, on the account page and on the Today card).
export function BackupText({ backup }: { backup: Backup }) {
  const t = useTranslations('backup')
  const count = backup.pending
  const text = {
    signedOut: null,
    ok: [t('ok.title'), t('ok.body')],
    busy: [t('busy.title', { count }), t('busy.body')],
    offline: [t('offline.title'), t('offline.body', { count })],
    retry: [t('retry.title'), t('retry.body', { count })],
    expired: [t('expired.title'), t('expired.body', { count })],
    update: [t('update.title'), t('update.body')],
  }[backup.state]
  if (text === null) return null
  return (
    <div className="flex flex-col gap-4">
      <p className="text-section">{text[0]}</p>
      <p className="text-body text-ink-2">{text[1]}</p>
    </div>
  )
}

const actionClass = {
  ink: 'rounded-ctl bg-ink py-12 text-center text-body font-semibold text-bg',
  sunk: 'rounded-ctl bg-sunk py-12 text-center text-body font-semibold text-ink',
}

// The state's one action, if it has one: back up now, retry, sign in again, or
// apply a downloaded update.
export function BackupAction({ backup, tone }: { backup: Backup; tone: 'ink' | 'sunk' }) {
  const t = useTranslations('backup')
  const updateWaiting = useSyncExternalStore(appUpdate.subscribe, appUpdate.isWaiting, notWaiting)
  const className = actionClass[tone]
  switch (backup.state) {
    case 'ok':
    case 'retry':
      return (
        <Pressable onClick={backUpNow} className={className}>
          {backup.state === 'ok' ? t('backUpNow') : t('retryNow')}
        </Pressable>
      )
    case 'expired':
      return (
        <PressableLink href="/settings/sign-in" className={className}>
          {t('signInAgain')}
        </PressableLink>
      )
    case 'update':
      return updateWaiting ? (
        <Pressable
          onClick={() => {
            appUpdate.apply(navigator.serviceWorker, () => {
              window.location.reload()
            })
          }}
          className={className}
        >
          {t('updateNow')}
        </Pressable>
      ) : null
    case 'busy':
    case 'offline':
    case 'signedOut':
      return null
  }
}

// "Just now" within a minute, then the day and time.
export function useLastBackupText(lastSyncAt: string | null): string {
  const t = useTranslations('backup')
  const locale = useLocale()
  // Read once when shown: the sheet and the account page are opened, read and closed.
  const [now] = useState(() => Date.now())
  if (lastSyncAt === null) return t('never')
  const at = new Date(lastSyncAt)
  if (now - at.getTime() < 60 * 1000) return t('justNow')
  return new Intl.DateTimeFormat(locale, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(at)
}

// The rows under the state: account, last backup, changes waiting.
export function BackupFacts({ backup }: { backup: Backup }) {
  const t = useTranslations('backup')
  const last = useLastBackupText(backup.lastSyncAt)
  const rows = [
    ...(backup.email === null ? [] : [[t('account'), backup.email] as const]),
    [t('lastBackup'), last] as const,
    [t('waiting'), t('waitingCount', { count: backup.pending })] as const,
  ]
  return (
    <dl className="flex flex-col rounded-ctl bg-bg px-16">
      {rows.map(([label, value], index) => (
        <div
          key={label}
          className={`flex items-baseline justify-between gap-12 py-12 ${index < rows.length - 1 ? 'border-b border-line' : ''}`}
        >
          <dt className="text-label text-ink-2">{label}</dt>
          <dd className="num min-w-0 truncate text-label text-ink">{value}</dd>
        </div>
      ))}
    </dl>
  )
}
