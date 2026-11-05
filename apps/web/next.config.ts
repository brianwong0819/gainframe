import type { NextConfig } from 'next'

// Pages named `page.dev.tsx` (the design kitchen sink) exist only in `next dev`
// and in builds with GAINFRAME_DEV_PAGES=1 (the dev deploy), never in prod.
const devPages = process.env.NODE_ENV === 'development' || process.env.GAINFRAME_DEV_PAGES === '1'

// Static export only: the site is served from S3 + CloudFront (see CLAUDE.md).
const nextConfig: NextConfig = {
  output: 'export',
  pageExtensions: devPages ? ['dev.tsx', 'tsx', 'ts'] : ['tsx', 'ts'],
}

export default nextConfig
