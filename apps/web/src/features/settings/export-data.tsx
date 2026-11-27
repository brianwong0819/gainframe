'use client'

import { useTranslations } from 'next-intl'
import { useState } from 'react'

import { useBackup } from '@/features/account/use-backup'
import { db } from '@/db/client'
import { exportData, exportFileName } from '@/db/export'
import { useLiveQuery } from '@/db/use-live-query'
import { reportError } from '@/diagnostics/report'
import { deviceTimeZone } from '@/i18n/time-zone'
import { release } from '@/release'
import { Pressable } from '@/ui/pressable'

import { ImportData } from './import-data'

// Read ahead and kept current, so the tap can hand the file to the share sheet
// at once: Safari allows `navigator.share` only while the tap's user activation
// lasts, which awaiting IndexedDB could outlast.
const loadExport = () => exportData(db, release, new Date().toISOString())

const live = (row: { deletedAt: string | null }) => row.deletedAt === null

/** Saves the file through the browser's download, where there is no share sheet. */
function download(file: File) {
  const url = URL.createObjectURL(file)
  const link = document.createElement('a')
  link.href = url
  link.download = file.name
  link.click()
  // The download has started from the URL by the next task; free it after.
  setTimeout(() => {
    URL.revokeObjectURL(url)
  })
}

// "Export all data (JSON)": a copy of the data in a file, which "Import from a
// file" reads back on another device or environment. On the iPhone it opens
// the share sheet ("Save to Files").
export function ExportData() {
  const t = useTranslations('diagnostics')
  const signedIn = (useBackup()?.state ?? 'signedOut') !== 'signedOut'
  const data = useLiveQuery(loadExport)
  const [failed, setFailed] = useState(false)

  function exportFile() {
    if (data === undefined) return
    const exportedAt = new Date().toISOString()
    const file = new File(
      [JSON.stringify({ ...data, exportedAt }, null, 2)],
      exportFileName(exportedAt, deviceTimeZone()),
      { type: 'application/json' },
    )
    setFailed(false)
    if (typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
      navigator.share({ files: [file] }).catch((reason: unknown) => {
        // Closing the share sheet rejects with AbortError: the user's choice.
        if (reason instanceof DOMException && reason.name === 'AbortError') return
        setFailed(true)
        reportError('unhandledrejection', reason)
      })
      return
    }
    download(file)
  }

  return (
    <section className="flex flex-col gap-12">
      <h2 className="text-label text-ink-3">{t('backup')}</h2>
      <div className="flex flex-col gap-12 rounded-group bg-surface p-16">
        <p className="text-label text-ink-2">
          {signedIn ? t('backupHintSignedIn') : t('backupHint')}
        </p>
        {data !== undefined && (
          <>
            <p className="text-label text-ink-3" data-testid="export-counts">
              {t('backupCounts', {
                workouts: data.tables.workouts.filter(live).length,
                plans: data.tables.plans.filter(live).length,
                exercises: data.tables.exercises.filter(live).length,
              })}
            </p>
            <Pressable
              onClick={exportFile}
              className="rounded-ctl bg-accent py-12 text-body font-semibold text-accent-ink"
            >
              {t('export')}
            </Pressable>
          </>
        )}
        {failed && <p className="text-label text-ink-2">{t('exportFailed')}</p>}
        <ImportData />
      </div>
    </section>
  )
}
