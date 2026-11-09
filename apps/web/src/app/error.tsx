'use client'

import { useTranslations } from 'next-intl'

import { ErrorScreen } from '@/diagnostics/error-screen'

// Catches errors in every page below the root layout, which keeps the
// providers, so the screen is translated and styled.
export default function RootError({ error, retry }: { error: unknown; retry: () => void }) {
  const t = useTranslations('error')
  return (
    <ErrorScreen
      error={error}
      retry={retry}
      text={{ title: t('title'), body: t('body'), retry: t('retry') }}
    />
  )
}
