'use client'

import { useTranslations } from 'next-intl'

import { SignIn } from '@/features/account/sign-in'
import { BackLink } from '@/ui/back-link'

export default function SignInPage() {
  const t = useTranslations('settings')
  const tSignIn = useTranslations('signIn')
  return (
    <main className="flex flex-col gap-20">
      <header className="flex flex-col gap-8">
        <BackLink href="/settings" label={t('title')} />
        <h1 className="text-title">{tSignIn('title')}</h1>
      </header>
      <SignIn />
    </main>
  )
}
