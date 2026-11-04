import type { Metadata } from 'next'
import type { ReactNode } from 'react'

import { release } from '@/release'

export const metadata: Metadata = {
  title: 'Gainframe',
  // Lets anyone (and later the diagnostics screen) read which build is live.
  other: { release },
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
