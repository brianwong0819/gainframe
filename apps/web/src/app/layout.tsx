import type { Metadata, Viewport } from 'next'
import type { ReactNode } from 'react'

import { PersistOnLaunch } from '@/db/persist-on-launch'
import { pwaImageDir, startupImages } from '@/pwa/images'
import { LaunchScreen } from '@/pwa/launch-screen'
import { ServiceWorker } from '@/pwa/service-worker'
import { loadThemeColors } from '@/pwa/theme-colors'
import { release } from '@/release'
import { martianMono } from '@/styles/fonts'
import { MotionProvider } from '@/ui/motion-provider'

import '@/styles/globals.css'

const colors = loadThemeColors()

export const metadata: Metadata = {
  title: 'Gainframe',
  // Home-screen launch on iOS: full screen, the status bar over --bg (via
  // theme-color below) and a splash screen per device size and colour scheme.
  appleWebApp: {
    capable: true,
    title: 'Gainframe',
    statusBarStyle: 'default',
    startupImage: startupImages,
  },
  icons: { icon: `/${pwaImageDir}/icon-192.png`, apple: `/${pwaImageDir}/apple-touch-icon.png` },
  // Lets anyone (and later the diagnostics screen) read which build is live.
  other: { release },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // Content may extend under the notch and home indicator; globals.css pads by the safe areas.
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: colors.light.bg },
    { media: '(prefers-color-scheme: dark)', color: colors.dark.bg },
  ],
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={martianMono.variable}>
      <body>
        <div className="status-bar-fill" aria-hidden />
        <MotionProvider>
          {children}
          <LaunchScreen />
        </MotionProvider>
        <ServiceWorker />
        <PersistOnLaunch />
      </body>
    </html>
  )
}
