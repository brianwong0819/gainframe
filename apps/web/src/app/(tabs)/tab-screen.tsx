'use client'

import { ViewTransition, type ReactNode } from 'react'

// Wraps each tab page (not the layout, which persists) so a tab switch runs
// the `tab` view transition from globals.css. Other navigations do not animate.
export function TabScreen({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <ViewTransition
      enter={{ tab: 'tab-enter', default: 'none' }}
      exit={{ tab: 'tab-exit', default: 'none' }}
      default="none"
    >
      <main className="flex flex-col gap-20">
        <h1 className="text-title">{title}</h1>
        {children}
      </main>
    </ViewTransition>
  )
}
