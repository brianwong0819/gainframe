import type { Metadata } from 'next'
import type { ReactNode } from 'react'

import { release } from '@/release'
import { martianMono } from '@/styles/fonts'
import { MotionProvider } from '@/ui/motion-provider'

import '@/styles/globals.css'

export const metadata: Metadata = {
  title: 'Gainframe',
  // Lets anyone (and later the diagnostics screen) read which build is live.
  other: { release },
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={martianMono.variable}>
      <body>
        <MotionProvider>{children}</MotionProvider>
      </body>
    </html>
  )
}
