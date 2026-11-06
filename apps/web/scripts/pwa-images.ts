import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'

import { pwaImageDir, renderPwaImages } from '../src/pwa/images.ts'
import { loadThemeColors } from '../src/pwa/theme-colors.ts'

// Renders the app icons and splash screens into public/pwa/ (git-ignored).
const dir = path.join('public', pwaImageDir)
mkdirSync(dir, { recursive: true })
for (const { file, png } of renderPwaImages(loadThemeColors())) {
  writeFileSync(path.join(dir, file), png)
}
