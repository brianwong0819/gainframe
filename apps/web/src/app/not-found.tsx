'use client'

import { useTranslations } from 'next-intl'
import Link from 'next/link'

// Exported as 404.html, which the CloudFront route function serves for unknown paths.
export default function NotFound() {
  const t = useTranslations('notFound')
  return (
    <main className="flex flex-col gap-20">
      <h1 className="text-title">{t('title')}</h1>
      <Link href="/" className="py-12 text-body text-accent">
        {t('back')}
      </Link>
    </main>
  )
}
