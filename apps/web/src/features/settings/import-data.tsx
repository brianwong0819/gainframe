'use client'

import { useLocale, useTranslations } from 'next-intl'
import { useRef, useState } from 'react'

import { backUpNow, useBackup } from '@/features/account/use-backup'
import { db } from '@/db/client'
import { checkImport, type ImportCheck, importData } from '@/db/import'
import { reportError } from '@/diagnostics/report'
import { Pressable } from '@/ui/pressable'
import { Sheet } from '@/ui/sheet'

type Step =
  | { kind: 'closed' }
  | { kind: 'checked'; name: string; check: ImportCheck }
  | { kind: 'importing'; name: string }
  | { kind: 'done'; count: number }
  | { kind: 'failed' }

// "Import from a file": brings the records of an exported file (ExportData)
// onto this device, for moving to another environment or phone. The whole file
// is checked and summarised in a sheet before anything is written; nothing
// changes until the user taps Import. Rows are matched by ID and the newer one
// wins, as in a backup, so records only on this device stay and a second
// import of the same file changes nothing (db/import.ts).
export function ImportData() {
  const t = useTranslations('diagnostics')
  const locale = useLocale()
  const signedIn = (useBackup()?.state ?? 'signedOut') !== 'signedOut'
  const input = useRef<HTMLInputElement>(null)
  const [step, setStep] = useState<Step>({ kind: 'closed' })

  function fail(reason: unknown) {
    setStep({ kind: 'failed' })
    reportError('unhandledrejection', reason)
  }

  function read(file: File) {
    file
      .text()
      .then((text) => checkImport(db, text))
      .then((check) => {
        setStep({ kind: 'checked', name: file.name, check })
      }, fail)
  }

  function confirm(check: Extract<ImportCheck, { status: 'ready' }>, name: string) {
    setStep({ kind: 'importing', name })
    importData(db, check.preview.file).then((count) => {
      setStep({ kind: 'done', count })
      if (signedIn && count > 0) backUpNow()
    }, fail)
  }

  const close = () => {
    setStep({ kind: 'closed' })
  }
  const chooseFile = () => input.current?.click()

  const dateFormat = new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

  function body() {
    switch (step.kind) {
      case 'closed':
        return null
      case 'importing':
        return (
          <Pressable
            disabled
            className="rounded-ctl bg-accent py-12 text-body font-semibold text-accent-ink disabled:opacity-40"
          >
            {t('importing')}
          </Pressable>
        )
      case 'done':
        return (
          <>
            <p className="text-body font-semibold text-ink" data-testid="import-result">
              {t('importDone', { count: step.count })}
            </p>
            {step.count > 0 && (
              <p className="text-label text-ink-2">
                {signedIn ? t('importDoneSignedIn') : t('importDoneSignedOut')}
              </p>
            )}
            <Pressable
              onClick={close}
              className="rounded-ctl bg-accent py-12 text-body font-semibold text-accent-ink"
            >
              {t('importClose')}
            </Pressable>
          </>
        )
      case 'failed':
        return <p className="text-body text-ink-2">{t('importFailed')}</p>
      case 'checked': {
        const { check } = step
        if (check.status !== 'ready') {
          return (
            <>
              <p className="text-body text-ink-2">{t(`importRefused.${check.status}`)}</p>
              <Pressable
                onClick={chooseFile}
                className="rounded-ctl bg-sunk py-12 text-body font-semibold text-ink"
              >
                {t('importOther')}
              </Pressable>
            </>
          )
        }
        const { preview } = check
        return (
          <>
            <div className="flex flex-col gap-4 rounded-group bg-sunk p-16">
              <p className="text-body font-semibold break-all text-ink">{step.name}</p>
              <p className="text-label text-ink-3">
                {t('importExportedAt', {
                  date: dateFormat.format(new Date(preview.file.exportedAt)),
                })}
              </p>
              <p className="text-label text-ink-2" data-testid="import-counts">
                {t('importCounts', {
                  workouts: preview.workouts,
                  plans: preview.plans,
                  exercises: preview.exercises,
                  meals: preview.meals,
                  weighIns: preview.weighIns,
                })}
              </p>
            </div>
            <p className="text-label text-ink-2">
              {preview.changes === 0
                ? t('importNothing')
                : t('importChanges', { count: preview.changes })}
            </p>
            {preview.changes > 0 && (
              <Pressable
                onClick={() => {
                  confirm(check, step.name)
                }}
                className="rounded-ctl bg-accent py-12 text-body font-semibold text-accent-ink"
              >
                {t('importConfirm', { count: preview.changes })}
              </Pressable>
            )}
          </>
        )
      }
    }
  }

  return (
    <>
      <Pressable
        onClick={chooseFile}
        className="rounded-ctl bg-sunk py-12 text-body font-semibold text-ink"
      >
        {t('import')}
      </Pressable>
      <input
        ref={input}
        type="file"
        accept=".json,application/json"
        className="hidden"
        data-testid="import-file"
        onChange={(event) => {
          const file = event.target.files?.[0]
          // Cleared so that choosing the same file again fires another change.
          event.target.value = ''
          if (file !== undefined) read(file)
        }}
      />
      <Sheet
        open={step.kind !== 'closed'}
        // The import cannot be stopped once its transaction has started.
        onClose={step.kind === 'importing' ? () => undefined : close}
        title={t('importTitle')}
        closeLabel={t('importClose')}
      >
        <div className="flex flex-col gap-16 pb-16">{body()}</div>
      </Sheet>
    </>
  )
}
