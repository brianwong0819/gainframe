import type { MetadataRoute } from 'next'

import { pwaImageDir } from '@/pwa/images'
import { loadThemeColors } from '@/pwa/theme-colors'

export const dynamic = 'force-static'

export default function manifest(): MetadataRoute.Manifest {
  const { light } = loadThemeColors()
  const icon = (size: number) => ({
    src: `/${pwaImageDir}/icon-${String(size)}.png`,
    sizes: `${String(size)}x${String(size)}`,
    type: 'image/png',
  })
  return {
    id: '/',
    name: 'Gainframe',
    short_name: 'Gainframe',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: light.bg,
    theme_color: light.bg,
    icons: [
      { ...icon(192), purpose: 'any' },
      { ...icon(512), purpose: 'any' },
      { ...icon(512), purpose: 'maskable' },
    ],
  }
}
