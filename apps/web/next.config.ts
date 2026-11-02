import type { NextConfig } from 'next'

// Static export only: the site is served from S3 + CloudFront (see CLAUDE.md).
const nextConfig: NextConfig = {
  output: 'export',
}

export default nextConfig
