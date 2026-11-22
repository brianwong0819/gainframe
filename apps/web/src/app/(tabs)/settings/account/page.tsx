'use client'

import { useTranslations } from 'next-intl'

import { Account } from '@/features/account/account'
import { BackLink } from '@/ui/back-link'

export default function AccountPage() {
  const t = useTranslations('settings')
  const tAccount = useTranslations('account')
  return (
    <main className="flex flex-col gap-20">
      <header className="flex flex-col gap-8">
        <BackLink href="/settings" label={t('title')} />
        <h1 className="text-title">{tAccount('title')}</h1>
      </header>
      <Account />
    </main>
  )
}
