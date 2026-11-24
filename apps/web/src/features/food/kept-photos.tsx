'use client'

import { useLocale, useTranslations } from 'next-intl'

import type { PendingPhoto } from '@/db/schema'
import { PressableLink } from '@/ui/pressable'

import { formatTime } from '../history/dates'

const stateOf = (row: PendingPhoto) =>
  row.estimate !== null ? 'ready' : row.stoppedBy !== null ? 'stopped' : 'waiting'

// The day's photos kept while offline (M3-03), above its meals. Each counts as
// zero until it is confirmed, and says so; a tap opens it on the photo screen.
export function KeptPhotos({ rows }: { rows: readonly PendingPhoto[] }) {
  const t = useTranslations('food')
  const locale = useLocale()
  if (rows.length === 0) return null
  return (
    <section className="flex flex-col gap-8">
      <h2 className="text-label text-ink-3">{t('keptPhotos')}</h2>
      <ol className="flex flex-col gap-8">
        {rows.map((row) => (
          <li key={row.id}>
            <PressableLink
              href={`/food/photo#${row.id}`}
              className="flex w-full items-center gap-12 rounded-group bg-surface p-16"
            >
              <span
                aria-hidden
                style={{
                  backgroundImage: `url(data:${row.photo.type};base64,${row.photo.base64})`,
                }}
                className="size-40 shrink-0 rounded-ctl bg-sunk bg-cover bg-center"
              />
              <span className="flex min-w-0 flex-1 flex-col gap-4">
                <span className="num text-label text-ink-3">
                  {formatTime(row.takenAt, locale)} · {t(`mealType.${row.mealType}`)}
                </span>
                <span
                  className={`truncate text-body ${stateOf(row) === 'ready' ? 'text-accent' : 'text-ink'}`}
                >
                  {t(`keptState.${stateOf(row)}`)}
                </span>
              </span>
              <span className="shrink-0 text-label text-ink-3">{t('keptNotCounted')}</span>
            </PressableLink>
          </li>
        ))}
      </ol>
    </section>
  )
}
