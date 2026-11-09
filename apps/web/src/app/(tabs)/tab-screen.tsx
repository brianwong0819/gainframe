import type { ReactNode } from 'react'

// The shared frame of a tab screen. A tab switch swaps screens at once (bw's
// call after the M1-03 iPhone check); only the tab bar animates.
export function TabScreen({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <main className="flex flex-col gap-20">
      <h1 className="text-title">{title}</h1>
      {children}
    </main>
  )
}
