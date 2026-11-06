import { injectManifest } from '@serwist/build'
import { build } from 'rolldown'

import { pwaImageDir } from '../src/pwa/images.ts'

// Runs after `next build`. Bundles the service worker, then writes the list of
// files in out/ into it, so each release precaches exactly its own files.
const bundle = '.next/sw/sw.js'

await build({
  input: 'src/sw/sw.ts',
  platform: 'browser',
  transform: { define: { 'process.env.NODE_ENV': '"production"' } },
  output: { file: bundle, format: 'iife', minify: true },
})

const { warnings } = await injectManifest({
  swSrc: bundle,
  swDest: 'out/sw.js',
  globDirectory: 'out',
  globPatterns: ['**/*'],
  // Icons and splash screens are read by iOS when the app is installed or
  // launched, never by the app itself.
  globIgnores: [`${pwaImageDir}/**`],
  // Content-hashed file names: the URL already changes with the content.
  dontCacheBustURLsMatching: /^_next\/static\//,
})
if (warnings.length > 0) throw new Error(`Service worker build: ${warnings.join('\n')}`)
