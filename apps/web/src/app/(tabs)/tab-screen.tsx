import type { ReactNode } from 'react'

// The shared frame of a tab screen, with an optional line under the title
// (Today's date) and an optional control beside it (Today's settings link). A tab switch swaps screens at once (bw's call after
// the M1-03 iPhone check); only the tab bar animates.
export function TabScreen({
  title,
  subtitle,
  action,
  children,
}: {
  title: string
  subtitle?: string | undefined
  action?: ReactNode
  children?: ReactNode
}) {
  return (
    <main className="flex flex-col gap-20">
      <header className="flex items-center justify-between gap-12">
        <div className="flex flex-col gap-4">
          <h1 className="text-title">{title}</h1>
          {subtitle !== undefined && <p className="text-label text-ink-3">{subtitle}</p>}
        </div>
        {action}
      </header>
      {children}
    </main>
  )
}
