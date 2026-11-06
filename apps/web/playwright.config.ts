import { defineConfig } from '@playwright/test'

import { deviceMatrix } from './e2e/devices.ts'

const port = 4173

// Layout checks over the static export (`pnpm build` first). Docs: "Device QA"
// in docs/design-system.md.
export default defineConfig({
  testDir: 'e2e',
  forbidOnly: Boolean(process.env.CI),
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${String(port)}`,
    // Each test loads a fresh page; a cached shell would hide layout changes.
    serviceWorkers: 'block',
    reducedMotion: 'reduce',
    trace: 'off',
  },
  projects: deviceMatrix.map((device) => ({
    name: device.name,
    use: { ...device.descriptor, viewport: device.viewport },
  })),
  webServer: {
    command: 'node e2e/serve.ts',
    env: { PORT: String(port) },
    port,
    reuseExistingServer: !process.env.CI,
  },
})
