import type { ReactNode } from 'react'

// The shared frame of a tab screen, with an optional control beside the title
// (Today's settings link). A tab switch swaps screens at once (bw's call after
// the M1-03 iPhone check); only the tab bar animates.
export function TabScreen({
  title,
  action,
  children,
}: {
  title: string
  action?: ReactNode
  children?: ReactNode
}) {
  return (
    <main className="flex flex-col gap-20">
      <header className="flex items-center justify-between gap-12">
        <h1 className="text-title">{title}</h1>
        {action}
      </header>
      {children}
    </main>
  )
}
