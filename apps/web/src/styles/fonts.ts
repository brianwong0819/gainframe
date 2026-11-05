import localFont from 'next/font/local'

// Martian Mono (SIL OFL 1.1, see ./fonts/OFL.txt), latin subset, variable
// weight. Self-hosted: no third-party request, and it works offline.
export const martianMono = localFont({
  src: './fonts/martian-mono-latin.woff2',
  weight: '300 600',
  display: 'swap',
  variable: '--font-martian-mono',
})
