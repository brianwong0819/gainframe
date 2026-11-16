'use client'

import { useLocale, useTranslations } from 'next-intl'
import { useEffect, useRef, useState } from 'react'

import { db } from '@/db/client'
import { readPersisted } from '@/db/persistent-storage'
import { useLiveQuery } from '@/db/use-live-query'
import { recentErrors } from '@/diagnostics/error-log'
import { formatErrorReport } from '@/diagnostics/error-report'
import { release } from '@/release'
import { Pressable } from '@/ui/pressable'

import { ClearData } from './clear-data'
import { ExportData } from './export-data'

const loadErrors = () => recentErrors(db)

// How long "Copied" shows on the button before it reads "Copy" again.
const COPIED_FEEDBACK_MS = 2000

/** Whether the browser keeps the database under storage pressure; null if it cannot say. */
function usePersisted(): boolean | null | undefined {
  const [persisted, setPersisted] = useState<boolean | null>()
  useEffect(() => {
    void readPersisted('storage' in navigator ? navigator.storage : undefined).then(setPersisted)
  }, [])
  return persisted
}

// What a developer needs from the phone without Web Inspector: the build, the
// storage guarantee, a backup of the data, the errors recorded by
// src/diagnostics and a reset of the device's data.
export function Diagnostics() {
  const t = useTranslations('diagnostics')
  const locale = useLocale()
  const errors = useLiveQuery(loadErrors)
  const persisted = usePersisted()
  const [copy, setCopy] = useState<'idle' | 'copied' | 'failed'>('idle')
  const resetTimer = useRef<number>(undefined)
  useEffect(
    () => () => {
      window.clearTimeout(resetTimer.current)
    },
    [],
  )

  const persistedText =
    persisted === undefined
      ? ''
      : persisted === null
        ? t('persistedUnknown')
        : persisted
          ? t('persistedYes')
          : t('persistedNo')

  function copyReport() {
    if (errors === undefined) return
    const text = formatErrorReport(
      {
        release,
        userAgent: navigator.userAgent,
        persisted: persisted ?? null,
        copiedAt: new Date().toISOString(),
      },
      errors,
    )
    // Called inside the tap: Safari allows clipboard writes only from a user gesture.
    navigator.clipboard.writeText(text).then(
      () => {
        setCopy('copied')
      },
      // Denied by the browser (no permission or no user gesture): an expected
      // outcome shown on the button, not an error worth recording.
      () => {
        setCopy('failed')
      },
    )
    window.clearTimeout(resetTimer.current)
    resetTimer.current = window.setTimeout(() => {
      setCopy('idle')
    }, COPIED_FEEDBACK_MS)
  }

  const timeFormat = new Intl.DateTimeFormat(locale, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

  return (
    <>
      <dl className="flex flex-col rounded-group bg-surface px-16">
        <div className="flex items-baseline justify-between gap-12 border-b border-line py-12">
          <dt className="text-body text-ink-2">{t('release')}</dt>
          <dd className="num text-body text-ink" data-testid="release">
            {release.slice(0, 7)}
          </dd>
        </div>
        <div className="flex flex-col gap-4 py-12">
          <div className="flex items-baseline justify-between gap-12">
            <dt className="text-body text-ink-2">{t('persisted')}</dt>
            <dd className="text-body text-ink" data-testid="persisted">
              {persistedText}
            </dd>
          </div>
          {persisted === false && <p className="text-label text-ink-3">{t('persistedNoHint')}</p>}
        </div>
      </dl>

      <ExportData />

      <section className="flex flex-col gap-12">
        <div className="flex items-center justify-between gap-12">
          <h2 className="text-label text-ink-3">{t('errors', { count: errors?.length ?? 0 })}</h2>
          {errors !== undefined && (
            <Pressable
              onClick={copyReport}
              className="rounded-ctl bg-sunk px-16 py-8 text-label text-ink"
            >
              {copy === 'copied' ? t('copied') : copy === 'failed' ? t('copyFailed') : t('copy')}
            </Pressable>
          )}
        </div>
        {errors?.length === 0 && <p className="text-body text-ink-3">{t('noErrors')}</p>}
        {errors !== undefined && errors.length > 0 && (
          <ol className="flex flex-col rounded-group bg-surface px-16">
            {errors.map((error) => (
              <li
                key={error.seq}
                className="flex flex-col gap-4 border-b border-line py-12 last:border-b-0"
              >
                <p className="text-body break-words text-ink">{error.message}</p>
                <p className="num text-label text-ink-3">
                  {timeFormat.format(new Date(error.at))} · {error.route} · {error.source}
                </p>
              </li>
            ))}
          </ol>
        )}
      </section>

      <ClearData />
    </>
  )
}
